import { BookOpen, MessageCircle, Mail, ChevronDown, HelpCircle, FileText, Users } from "lucide-react";

const faqs = [
  {
    q: "如何发布学术笔记？",
    a: "登录后点击顶部导航栏的「发布」按钮，填写标题、选择学科分类、编写内容后即可发布。支持 Markdown 格式和 LaTeX 公式。",
  },
  {
    q: "如何关注其他用户？",
    a: "访问其他用户的个人主页，点击「关注」按钮即可。关注后可在首页「关注」标签页中查看 TA 的最新动态。",
  },
  {
    q: "如何加入学术研讨室？",
    a: "点击顶部导航栏的「研讨室」进入研讨室列表，选择感兴趣的研讨室并点击「加入」即可参与讨论。",
  },
  {
    q: "如何搜索论文或笔记？",
    a: "使用顶部搜索栏输入关键词，可以搜索论文、笔记和用户。支持按学科分类筛选搜索结果。",
  },
  {
    q: "支持哪些学科分类？",
    a: "目前支持计算机科学、数学、物理学、生物学、化学、医学、经济学、心理学、工程学、人文学科、法学、教育学等 12 个一级学科，以及若干二级学科。",
  },
  {
    q: "如何修改个人资料？",
    a: "登录后点击头像进入个人主页，点击「编辑资料」按钮即可修改昵称、头像、个人简介等信息。",
  },
];

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* 页面标题 */}
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <HelpCircle className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold">帮助与客服</h1>
        <p className="mt-2 text-muted-foreground">
          如果你在使用中遇到问题，可以在这里找到答案
        </p>
      </div>

      {/* 快速入口 */}
      <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <a
          href="#faq"
          className="flex flex-col items-center gap-2 rounded-xl border p-5 text-center transition-colors hover:bg-muted/50 cursor-pointer"
        >
          <FileText className="h-6 w-6 text-primary" />
          <h3 className="text-sm font-medium">使用指南</h3>
          <p className="text-xs text-muted-foreground">了解平台基本功能</p>
        </a>
        <a
          href="#community"
          className="flex flex-col items-center gap-2 rounded-xl border p-5 text-center transition-colors hover:bg-muted/50 cursor-pointer"
        >
          <Users className="h-6 w-6 text-primary" />
          <h3 className="text-sm font-medium">社区规范</h3>
          <p className="text-xs text-muted-foreground">维护良好学术氛围</p>
        </a>
        <a
          href="#contact"
          className="flex flex-col items-center gap-2 rounded-xl border p-5 text-center transition-colors hover:bg-muted/50 cursor-pointer"
        >
          <MessageCircle className="h-6 w-6 text-primary" />
          <h3 className="text-sm font-medium">联系客服</h3>
          <p className="text-xs text-muted-foreground">获取人工帮助</p>
        </a>
      </div>

      {/* FAQ */}
      <section id="faq" className="mb-10 scroll-mt-20">
        <h2 className="mb-4 text-lg font-semibold">常见问题</h2>
        <div className="space-y-3">
          {faqs.map((item, i) => (
            <details
              key={i}
              className="group rounded-xl border transition-colors open:bg-muted/30"
            >
              <summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-sm font-medium">
                {item.q}
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <div className="px-5 pb-4 text-sm leading-relaxed text-muted-foreground">
                {item.a}
              </div>
            </details>
          ))}
        </div>
      </section>

      {/* 社区规范 */}
      <section id="community" className="mb-10 scroll-mt-20 rounded-xl border bg-muted/20 p-6">
        <h2 className="mb-4 text-lg font-semibold">社区规范</h2>
        <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
          <p>为了维护良好的学术讨论氛围，请遵守以下规范：</p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>尊重每一位社区成员，保持礼貌和学术态度</li>
            <li>引用他人观点时请注明来源，尊重知识产权</li>
            <li>不发布与学术无关的广告或推广内容</li>
            <li>鼓励建设性的讨论和反馈，避免人身攻击</li>
            <li>如发现违规内容，请及时举报</li>
          </ul>
        </div>
      </section>

      {/* 联系方式 */}
      <section id="contact" className="scroll-mt-20 rounded-xl border bg-muted/20 p-6">
        <h2 className="mb-4 text-lg font-semibold">联系我们</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          如果以上内容没有解决你的问题，欢迎通过以下方式联系我们：
        </p>
        <div className="space-y-3">
          <div className="flex items-center gap-3 text-sm">
            <Mail className="h-4 w-4 text-primary" />
            <span>邮箱：support@xueshuhongshu.com</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <MessageCircle className="h-4 w-4 text-primary" />
            <span>微信公众号：学术红书</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <BookOpen className="h-4 w-4 text-primary" />
            <span>工作时间：周一至周五 9:00 - 18:00</span>
          </div>
        </div>
      </section>
    </div>
  );
}
