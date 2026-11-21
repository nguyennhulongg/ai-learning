# Trích xuất văn bản từ PDF cho pipeline RAG.
#
# Thuật ngữ:
#   - OCR (Optical Character Recognition): nhận dạng chữ từ ảnh, cần cho PDF scan vì trang chỉ là ảnh.
#   - Lớp text: phần chữ thật lưu trong PDF, có thể lấy trực tiếp mà không cần OCR.
#   - RAG (Retrieval-Augmented Generation): tìm tài liệu liên quan rồi đưa cho AI để trả lời.
#   - Pipeline: chuỗi các bước xử lý nối tiếp nhau.
#
# Giao tiếp với Next.js qua 3 luồng chuẩn mà mọi chương trình đều có:
#   - stdin (luồng nhập): nhận {"pdfUrl": "<signed URL>"}
#   - stdout (luồng xuất): trả về một dòng "__OCR_RESULT__{...json...}"
#   - stderr (luồng lỗi): ghi log tiến độ, tách riêng để không lẫn vào kết quả
# Signed URL là đường link tạm có chữ ký, cho phép tải file private trong thời gian ngắn.
#
# Với mỗi trang: dùng lớp text có sẵn nếu đọc được, nếu không thì OCR bằng Tesseract.

import csv
import io
import json
import os
import re
import statistics
import subprocess
import sys
import tempfile
import unicodedata
import urllib.request

# PyMuPDF: thư viện đọc PDF, lấy lớp text và vẽ trang PDF thành ảnh.
import pymupdf

# Pillow: thư viện xử lý ảnh của Python (xoay, thu nhỏ, lưu file).
# Tên gói cài là "pillow", nhưng khi import trong code phải viết là PIL.
from PIL import Image

# Đổi giá trị này khi đổi cách trích xuất, để biết dữ liệu trong DB được tạo bằng cách nào.
EXTRACTION_VERSION = "pymupdf+tesseract-vie-eng-600dpi-v2"

# Tesseract: chương trình OCR mã nguồn mở, cài riêng trên máy chứ không phải thư viện Python.
# Biến môi trường TESSERACT_CMD (khai báo trong .env.local) cho biết file chạy nằm ở đâu.
TESSERACT = os.environ.get("TESSERACT_CMD", "tesseract")

# Dấu mốc để Node.js nhận ra dòng kết quả giữa các dòng in khác trên stdout.
RESULT_MARKER = "__OCR_RESULT__"

# DPI (dots per inch): số điểm ảnh trên mỗi inch giấy, càng cao ảnh càng nét và càng nặng.
# Render là vẽ trang PDF thành ảnh. Ở 600 DPI, số trong bảng đọc chính xác hơn 300 DPI,
# đổi lại tốn thêm RAM.
OCR_DPI = 600

# OSD (Orientation and Script Detection): chế độ của Tesseract để đoán chiều xoay và hệ chữ.
# Nếu độ tin cậy thấp hơn mức này thì không tin kết quả, chuyển sang thử cả 4 hướng.
OSD_MIN_CONFIDENCE = 2.0

# Trang có ít hơn số ký tự này được coi là chưa có lớp text dùng được.
MIN_NATIVE_CHARS = 50

# Tỷ lệ ký tự lỗi tối đa trong lớp text trước khi phải OCR lại.
MAX_BAD_CHAR_RATIO = 0.01

# Tỷ lệ tối thiểu của chữ có dấu trong các chữ cái. Tiếng Việt thật có khoảng 16-29%,
# còn lớp text do phần mềm OCR không hỗ trợ tiếng Việt tạo ra thì gần như 0%,
# ví dụ "BAo cAo riNH HiNH TAI cHiNH" thay vì "BÁO CÁO TÌNH HÌNH TÀI CHÍNH".
# Lớp text đó toàn ký tự bình thường nên không phát hiện được bằng cách tìm ký tự lỗi.
# Trang tiếng Anh cũng bị OCR lại, chỉ tốn thêm thời gian chứ không sai kết quả.
MIN_VIETNAMESE_RATIO = 0.05

# TCVN3 (hay ABC) là bảng mã tiếng Việt cũ, có trước Unicode.
# Bảng mã là quy ước số nào ứng với ký tự nào, nên đọc sai bảng mã sẽ ra chữ lạ:
# "Ng©n hµng" thay vì "Ngân hàng". Đây là các ký tự thường gặp khi xảy ra lỗi đó.
TCVN3_CHARS = set("µ¸¶·¹¨»¾¼½Æ©ÇÊÈÉË®ÐÌÎÏÑªÓÒÔÕÖ«")

# Ảnh render ở 600 DPI rất lớn, vượt ngưỡng cảnh báo mặc định của Pillow.
Image.MAX_IMAGE_PIXELS = None


# Kiểm tra lớp text có sẵn của PDF có dùng được không.
# Trả về False nếu trang quá ít chữ, hoặc có nhiều ký tự lỗi (hỏng font, sai bảng mã).
def native_text_ok(text):
    chars = [c for c in text if not c.isspace()]
    if len(chars) < MIN_NATIVE_CHARS:
        return False

    # Ký tự bị coi là lỗi:
    #   - �: ký tự thay thế, xuất hiện khi không giải mã được.
    #   - "Co": vùng Unicode riêng, font hỏng hay dùng làm mã tự chế.
    #   - "Cc": ký tự điều khiển, không phải chữ hiển thị được.
    bad_chars = sum(
        c == "�" or c in TCVN3_CHARS or unicodedata.category(c) in ("Co", "Cc")
        for c in chars
    )
    if bad_chars / len(chars) >= MAX_BAD_CHAR_RATIO:
        return False

    # Chuẩn hoá về NFC trước, để chữ có dấu chỉ còn là một ký tự không thuộc ASCII.
    letters = [c for c in unicodedata.normalize("NFC", text) if c.isalpha()]
    accented = sum(not c.isascii() for c in letters)
    return bool(letters) and accented / len(letters) >= MIN_VIETNAMESE_RATIO


# Chạy Tesseract trên một ảnh và trả về kết quả tiến trình.
# Tesseract là chương trình riêng nên ảnh được ghi ra file tạm, chạy xong tự xoá.
# subprocess là module để Python mở một chương trình khác và lấy kết quả của nó.
# OMP_THREAD_LIMIT giới hạn số luồng CPU của Tesseract, tránh chiếm hết máy.
def run_tesseract(image, *args):
    with tempfile.TemporaryDirectory() as tmp_dir:
        image_path = os.path.join(tmp_dir, "page.png")
        image.save(image_path)
        return subprocess.run(
            [TESSERACT, image_path, "-", *args],
            capture_output=True,
            timeout=120,
            env={**os.environ, "OMP_THREAD_LIMIT": "4"},
        )


# Tính độ tin cậy trung bình của các từ OCR được, dùng để so sánh các hướng xoay.
# Chữ bị xoay sai chiều thường cho điểm rất thấp.
# TSV (tab-separated values) là dạng bảng phân cách bằng tab; Tesseract dùng nó để trả
# từng từ kèm độ tin cậy "conf" từ 0 đến 100, giá trị -1 nghĩa là dòng đó không phải từ.
def mean_confidence(image):
    result = run_tesseract(image, "-l", "vie", "--psm", "3", "tsv")
    rows = csv.DictReader(
        io.StringIO(result.stdout.decode("utf-8", "replace")),
        delimiter="\t",
        quoting=csv.QUOTE_NONE,
    )
    confidences = [
        float(row["conf"])
        for row in rows
        if (row.get("text") or "").strip() and float(row["conf"]) >= 0
    ]
    return statistics.mean(confidences) if confidences else 0.0


# Xác định số độ cần xoay theo chiều kim đồng hồ để trang đứng thẳng.
# Chiều xoay có thể nằm ngay trong ảnh scan nên phải dò từ nội dung, không dựa vào metadata PDF.
def detect_rotation(image):
    small = image.resize((image.width // 2, image.height // 2))

    # --psm 0 yêu cầu Tesseract chỉ chạy OSD, không nhận dạng chữ.
    # OSD có thể báo lỗi khi trang ít chữ, nên ở đây chỉ đọc nội dung, không kiểm tra
    # returncode (mã thoát của chương trình: 0 là thành công, khác 0 là có lỗi).
    result = run_tesseract(small, "--psm", "0")
    output = (result.stdout + result.stderr).decode("utf-8", "replace")
    rotate = re.search(r"Rotate: (\d+)", output)
    confidence = re.search(r"Orientation confidence: ([\d.]+)", output)

    if rotate and confidence and float(confidence[1]) >= OSD_MIN_CONFIDENCE:
        return int(rotate[1])

    # OSD không chắc chắn: thử cả 4 hướng và lấy hướng OCR tự tin nhất.
    return max(
        (0, 90, 180, 270),
        key=lambda angle: mean_confidence(small.rotate(-angle, expand=True)),
    )


# OCR một trang: render thành ảnh xám, xoay thẳng, rồi nhận dạng chữ.
# PSM (Page Segmentation Mode) là cách Tesseract chia bố cục trang.
# --psm 6 coi trang là một khối văn bản, giúp các số trong bảng nằm đúng dòng.
# Ngôn ngữ "vie+eng" dùng đồng thời mô hình tiếng Việt và tiếng Anh.
def ocr_page(page):
    # Pixmap là ảnh dạng lưới điểm ảnh của PyMuPDF; ảnh xám giúp bỏ màu và nhẹ hơn.
    pixmap = page.get_pixmap(dpi=OCR_DPI, colorspace=pymupdf.csGRAY)

    # Chuyển sang ảnh của Pillow; "L" là chế độ ảnh xám, mỗi điểm ảnh một byte.
    image = Image.frombytes("L", (pixmap.width, pixmap.height), pixmap.samples)

    # PIL xoay ngược chiều kim đồng hồ khi góc dương, nên cần đổi dấu.
    upright = image.rotate(-detect_rotation(image), expand=True)

    result = run_tesseract(
        upright, "-l", "vie+eng", "--psm", "6", "--dpi", str(OCR_DPI)
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr.decode("utf-8", "replace"))

    return result.stdout.decode("utf-8", "replace").strip()


# Trích xuất toàn bộ PDF, chọn cách xử lý riêng cho từng trang.
# Một file có thể lẫn trang text và trang scan.
def extract_pdf(pdf_bytes):
    document = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    pages = []

    for index, page in enumerate(document):
        text = page.get_text().strip()
        source = "native"

        if not native_text_ok(text):
            text = ocr_page(page)
            source = "tesseract"

        print(
            f"page {index + 1}/{document.page_count}: {source}",
            file=sys.stderr,
            flush=True,
        )
        pages.append(
            {
                "page_number": index + 1,
                # Unicode có 2 cách lưu chữ có dấu: "ệ" một ký tự, hoặc "e" cộng các dấu riêng.
                # Hai cách nhìn giống nhau nhưng so sánh thì khác, làm tìm kiếm bị trượt.
                # NFC (Normalization Form C) gom tất cả về dạng một ký tự.
                "text": unicodedata.normalize("NFC", text),
                "text_source": source,
                "tables": [],
            }
        )

    return {
        "extraction_version": EXTRACTION_VERSION,
        "page_count": document.page_count,
        "pages": pages,
    }


# Điểm vào của script: đọc URL từ stdin, tải PDF, in kết quả JSON ra stdout.
def main():
    # Encoding là cách đổi ký tự thành byte. Windows mặc định dùng cp1252 (bảng mã Tây Âu),
    # không biểu diễn được tiếng Việt, nên phải ép cả 3 luồng sang UTF-8.
    sys.stdin.reconfigure(encoding="utf-8")
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

    pdf_url = json.load(sys.stdin)["pdfUrl"]

    with urllib.request.urlopen(pdf_url, timeout=60) as response:
        pdf_bytes = response.read()

    result = extract_pdf(pdf_bytes)

    # JSON là định dạng văn bản để trao đổi dữ liệu giữa Python và Node.js.
    # ensure_ascii=False giữ nguyên tiếng Việt; nếu không, mỗi chữ có dấu thành chuỗi \uXXXX
    # dài 6 ký tự và làm kết quả phình to.
    print(RESULT_MARKER + json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
