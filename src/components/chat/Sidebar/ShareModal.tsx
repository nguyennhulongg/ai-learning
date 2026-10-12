import { Modal, Input, Button, Space } from "antd";
import { LinkedinOutlined, FacebookOutlined, XOutlined, RedditOutlined } from "@ant-design/icons";
import { MODAL_TEXTS, SOCIAL_SHARE_URLS } from "@/constants/sidebar";

interface ShareModalProps {
  open: boolean;
  shareUrl: string;
  onClose: () => void;
  onCopyLink: () => void;
  onSocialShare: (platform: string) => void;
}

export default function ShareModal({
  open,
  shareUrl,
  onClose,
  onCopyLink,
  onSocialShare,
}: ShareModalProps) {
  return (
    <Modal
      title={MODAL_TEXTS.share.title}
      open={open}
      onCancel={onClose}
      footer={null}
      centered
    >
      <Space orientation="vertical" size="large" style={{ width: "100%" }}>
        <div>
          <Space.Compact style={{ width: "100%" }}>
            <Input value={shareUrl} readOnly style={{ flex: 1 }} />
            <Button type="link" onClick={onCopyLink}>
              {MODAL_TEXTS.share.copyButton}
            </Button>
          </Space.Compact>
        </div>
        <div style={{ color: "#9aa3a2", fontSize: "12px" }}>
          {MODAL_TEXTS.share.warning}
        </div>
        <div>
          <Space size="middle">
            <Button
              icon={<LinkedinOutlined />}
              onClick={() => onSocialShare("linkedin")}
            />
            <Button
              icon={<FacebookOutlined />}
              onClick={() => onSocialShare("facebook")}
            />
            <Button
              icon={<XOutlined />}
              onClick={() => onSocialShare("twitter")}
            />
            <Button
              icon={<RedditOutlined />}
              onClick={() => onSocialShare("reddit")}
            />
          </Space>
        </div>
      </Space>
    </Modal>
  );
}
