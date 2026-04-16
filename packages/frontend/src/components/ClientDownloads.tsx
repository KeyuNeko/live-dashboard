interface DownloadLink {
  label: string;
  hint: string;
  href: string;
  icon: string;
  download?: string;
  version?: string;
  sha256?: string;
}

const DOWNLOAD_LINKS: DownloadLink[] = [
  {
    label: "Windows 客户端",
    hint: "下载 .exe",
    href: "https://github.com/KeyuNeko/live-dashboard/releases/download/custom-windows-agent-20260416/live-dashboard-agent.exe",
    icon: "\u{1F5A5}",
    version: "2026.04.16.2",
    sha256: "426DB306E12E47DC342720BB90C0E22F6BFAC2E88D70FFD8F8BA92339162E99F",
  },
  {
    label: "Android App",
    hint: "下载 .apk",
    href: "https://github.com/KeyuNeko/live-dashboard/releases/download/custom-windows-agent-20260416/live-dashboard-android-release.apk",
    icon: "\u{1F4F1}",
    version: "1.1.0",
    sha256: "5E1198E1CF12F684EB39B79D6BB8D1429306885D6FD399AAAD04C5F2C28D59D4",
  },
];

export default function ClientDownloads() {
  return (
    <section className="card-decorated rounded-xl p-4 mb-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-sm font-bold text-[var(--color-text)]">
            客户端下载
          </h2>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            第一次接入设备时，先下载客户端，再在设置里填写服务器地址或申请 Token。
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {DOWNLOAD_LINKS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              target="_blank"
              rel="noreferrer"
              download={item.download}
              className="pill-btn text-xs"
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
              <span className="text-[10px] opacity-70">{item.hint}</span>
            </a>
          ))}
          <a
            href="https://github.com/KeyuNeko/live-dashboard/releases"
            target="_blank"
            rel="noreferrer"
            className="pill-btn text-xs"
          >
            <span>{"\u{1F517}"}</span>
            <span>全部发布</span>
          </a>
        </div>
      </div>
      <div className="mt-3 text-[10px] text-[var(--color-text-muted)] space-y-1">
        {DOWNLOAD_LINKS.filter((item) => item.version || item.sha256).map((item) => (
          <p key={`${item.href}-meta`}>
            {item.label}
            {item.version ? ` · 版本 ${item.version}` : ""}
            {item.sha256 ? ` · SHA256 ${item.sha256.slice(0, 12)}...${item.sha256.slice(-12)}` : ""}
          </p>
        ))}
      </div>
    </section>
  );
}
