interface DownloadLink {
  label: string;
  hint: string;
  href: string;
  icon: string;
  download?: string;
}

const DOWNLOAD_LINKS: DownloadLink[] = [
  {
    label: "Windows 客户端",
    hint: "下载 .exe",
    href: "https://github.com/KeyuNeko/live-dashboard/releases/download/custom-windows-agent-20260416/live-dashboard-agent.exe",
    icon: "\u{1F5A5}",
  },
  {
    label: "Android App",
    hint: "下载 .apk",
    href: "https://github.com/Monika-Dream/live-dashboard/releases/latest/download/live-dashboard.apk",
    icon: "\u{1F4F1}",
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
    </section>
  );
}
