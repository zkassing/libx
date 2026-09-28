import Link from "next/link";
import {
  AudioLines,
  FileText,
  Image as ImageIcon,
  ScrollText,
  Video as VideoIcon,
} from "lucide-react";
import { ForkButton } from "@/components/share/ForkButton";
import { buildSharePreview, findSharedWorkflow } from "@/server/workflow/share";

/** 节点种类 → 展示名/图标 */
const KIND_META: Record<
  string,
  { label: string; icon: typeof FileText }
> = {
  text: { label: "文本", icon: FileText },
  image: { label: "图片", icon: ImageIcon },
  video: { label: "视频", icon: VideoIcon },
  audio: { label: "音频", icon: AudioLines },
  script: { label: "脚本", icon: ScrollText },
};

export const dynamic = "force-dynamic";

/**
 * /share/[token] —— 分享链接预览页（**公开，不需要登录**）。
 * 展示工作流的元信息 + 变量清单，引导访客"复制到我的项目"。
 */
export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const wf = await findSharedWorkflow(token);

  if (!wf) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0b0b0d] px-6">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#17171a] p-8 text-center">
          <div className="text-[15px] font-medium text-white">
            分享链接不存在或已失效
          </div>
          <p className="mt-2 text-[12.5px] leading-relaxed text-white/45">
            分享可能已被作者关闭，或链接被改动过。
          </p>
          <Link
            href="/project"
            className="mt-6 inline-block rounded-lg bg-[#1677ff] px-5 py-2 text-[13px] text-white transition hover:bg-[#3b8cff]"
          >
            回到我的项目
          </Link>
        </div>
      </main>
    );
  }

  const share = buildSharePreview(wf);
  const kinds = Object.entries(share.nodeKinds).sort((a, b) => b[1] - a[1]);

  return (
    <main className="min-h-screen bg-[#0b0b0d] px-6 py-10">
      <div className="mx-auto w-full max-w-3xl">
        {/* 品牌 */}
        <div className="mb-8 flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#1677ff] text-[15px] font-bold text-white">
            AI
          </div>
          <span className="text-[15px] font-semibold tracking-wide text-white">
            AI 创作台
          </span>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#17171a]">
          {/* 封面 */}
          {share.coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={share.coverUrl}
              alt=""
              className="h-56 w-full object-cover"
            />
          )}

          <div className="p-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <h1 className="text-[22px] font-semibold text-white">
                  {share.title}
                </h1>
                <p className="mt-1.5 text-[12.5px] text-white/45">
                  {share.authorName} 分享的工作流 · 更新于{" "}
                  {share.updatedAt.toLocaleDateString("zh-CN")}
                </p>
              </div>
              <ForkButton token={token} />
            </div>

            {share.description && (
              <p className="mt-5 text-[13px] leading-relaxed whitespace-pre-wrap text-white/65">
                {share.description}
              </p>
            )}

            {/* 统计 */}
            <div className="mt-6 grid grid-cols-3 gap-3">
              <Stat label="节点" value={String(share.nodeCount)} />
              <Stat label="连线" value={String(share.edgeCount)} />
              <Stat label="变量" value={String(share.variables.length)} />
            </div>

            {/* 步骤构成 */}
            {kinds.length > 0 && (
              <section className="mt-7">
                <h2 className="text-[12px] tracking-wide text-white/40">
                  流程构成
                </h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {kinds.map(([kind, count]) => {
                    const meta = KIND_META[kind] ?? {
                      label: kind,
                      icon: FileText,
                    };
                    const Icon = meta.icon;
                    return (
                      <span
                        key={kind}
                        className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[12.5px] text-white/70"
                      >
                        <Icon className="size-3.5 text-white/45" />
                        {meta.label}
                        <span className="text-white/35">×{count}</span>
                      </span>
                    );
                  })}
                </div>
              </section>
            )}

            {/* 变量清单 */}
            {share.variables.length > 0 && (
              <section className="mt-7">
                <h2 className="text-[12px] tracking-wide text-white/40">
                  需要填写的内容
                </h2>
                <ul className="mt-3 space-y-2">
                  {share.variables.map((v) => (
                    <li
                      key={v.key}
                      className="flex items-baseline gap-2 text-[12.5px]"
                    >
                      <code className="rounded bg-white/6 px-1.5 py-0.5 text-[11.5px] text-[#7fb4ff]">
                        {`{{${v.key}}}`}
                      </code>
                      <span className="text-white/70">{v.label}</span>
                      {v.required && (
                        <span className="text-[11px] text-[#ff9c95]">
                          必填
                        </span>
                      )}
                      {v.source === "teacher" && (
                        <span className="text-[11px] text-white/30">
                          老师预设
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <p className="mt-8 border-t border-white/8 pt-5 text-[11.5px] leading-relaxed text-white/35">
              复制后会在你自己的项目里生成一份**独立副本**，可以随意修改、运行，
              不会影响原作者的工作流。
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] px-3.5 py-3">
      <div className="text-[18px] font-semibold text-white">{value}</div>
      <div className="mt-0.5 text-[11.5px] text-white/40">{label}</div>
    </div>
  );
}
