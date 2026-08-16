/** @type {import('./_venera_.js')} */
class MiaoQu extends ComicSource {
  // 妙趣漫画（MCCMS）：国内可直连，移动端页面服务端渲染，章节图片为 XOR+Base64 加密
  name = "妙趣漫画";
  key = "miaoqu";
  version = "1.0.2";
  minAppVersion = "1.4.0";
  url = "https://cdn.jsdelivr.net/gh/yelongyue197-svg/venera-sources@v1.0.2/miaoqu.js";
  api = "https://www.miaoqumh.org";
  mobile = "https://m.miaoqumh.org";

  init() {
    this.mobileUa =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
    this.desktopUa =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
    this.mobileHeaders = {
      "User-Agent": this.mobileUa,
      Referer: this.api + "/",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "zh-CN,zh;q=0.9",
    };
    this.desktopHeaders = {
      "User-Agent": this.desktopUa,
      Referer: this.api + "/",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "zh-CN,zh;q=0.9",
    };
    this.fetchText = async (url, referer, mobile) => {
      const headers = mobile ? this.mobileHeaders : this.desktopHeaders;
      const resp = await Network.get(url, { ...headers, Referer: referer || this.api + "/" });
      if (resp.status !== 200) {
        throw `HTTP ${resp.status}: ${url}`;
      }
      return resp.body;
    };
    // 章节图片解密 key 表（由站点 JS 固定，cid 为章节 id）
    this.decryptKeys = [
      "8-bXd9iN",
      "8-RXyjry",
      "8-oYvwVy",
      "8-4ZY57U",
      "8-mbJpU7",
      "8-6MM2Ei",
      "8-54TiQr",
      "8-Ph5xx9",
      "8-bYgePR",
      "8-Z9A3bW",
    ];
  }

  _abs(u, base) {
    if (!u) return "";
    u = u.trim();
    if (/^https?:/i.test(u)) return u;
    if (u.startsWith("//")) return "https:" + u;
    return base.replace(/\/+$/, "") + "/" + u.replace(/^\/+/, "");
  }

  _sortedChapters(entries) {
    const num = (name, key) => {
      const m1 = String(name).match(/第\s*(\d+)/);
      if (m1) return parseInt(m1[1], 10);
      const m2 = String(key).match(/^\d+\/(\d+)/);
      if (m2) return parseInt(m2[1], 10);
      const m3 = String(key).match(/(\d+)/);
      return m3 ? parseInt(m3[1], 10) : 0;
    };
    return entries
      .map((e, i) => ({ e, i, n: num(e[1], e[0]) }))
      .sort((a, b) => (a.n - b.n) || (a.i - b.i))
      .map((x) => x.e);
  }

  _parseList(html) {
    const comics = [];
    // 移动端列表 A：<li><div class="pic"><a href="/slug"><img src=".."></a></div><div class="neirong"><a href="/slug" class="name">标题</a>...
    const reA =
      /<div class="pic">\s*<a href="(\/[a-z0-9-]+)"[^>]*>\s*<img[^>]+src="([^"]+)"[^>]*>\s*<\/a>\s*<\/div>\s*<div class="neirong">\s*<a href="\1"[^>]*class="name"[^>]*>([^<]+)<\/a>/g;
    // 移动端列表 B：<li class=""><a href="/slug" class="pic"><img src=".."></a><a href="/slug" class="txt">标题</a><span class="author">作者</span></li>
    const reB =
      /<li[^>]*>\s*<a href="(\/[a-z0-9-]+)"\s+class="pic"[^>]*>\s*<img[^>]+src="([^"]+)"[^>]*>[\s\S]*?<a href="\1"\s+class="txt"[^>]*>([^<]+)<\/a>(?:\s*<span class="author">([^<]*)<\/span>)?/g;
    // 桌面端搜索结果：<a href="/slug" title="标题" class="manga-img"><img src=".."></a>
    const reC =
      /<a href="(\/[a-z0-9-]+)"\s+title="([^"]+)"\s+class="manga-img"[^>]*>\s*<img[^>]+src="([^"]+)"[^>]*>/g;
    let m;
    while ((m = reA.exec(html)) !== null || (m = reB.exec(html)) !== null) {
      const slug = m[1].replace(/^\//, "");
      const cover = this._abs(m[2], this.api);
      const title = (m[3] || "").trim();
      if (!slug || !title) continue;
      comics.push(
        new Comic({
          id: slug,
          title,
          cover,
          subTitle: (m[4] || "").trim(),
          tags: [],
        })
      );
    }
    while ((m = reC.exec(html)) !== null) {
      const slug = m[1].replace(/^\//, "");
      const title = (m[2] || "").trim();
      const cover = this._abs(m[3] || "", this.api);
      if (!slug || !title) continue;
      comics.push(new Comic({ id: slug, title, cover, tags: [] }));
    }
    const seen = new Set();
    return comics.filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)));
  }

  explore = [
    {
      title: this.name,
      type: "singlePageWithMultiPart",
      load: async () => {
        const html = await this.fetchText(this.mobile + "/", this.api + "/", true);
        const list = this._parseList(html);
        const result = {};
        if (list.length) result["推荐"] = list.slice(0, 20);
        return result;
      },
    },
  ];

  category = {
    title: this.name,
    parts: [
      {
        name: "分类",
        type: "fixed",
        categories: ["最新更新", "热门", "完结"],
        itemType: "category",
        categoryParams: ["/custom/update", "/custom/hot", "/custom/end"],
      },
    ],
    enableRankingPage: false,
  };

  categoryComics = {
    load: async (category, param, options, page) => {
      const url = this._abs(param || "/custom/update", this.mobile);
      const html = await this.fetchText(url, this.api + "/", true);
      const comics = this._parseList(html);
      return { comics, maxPage: 1 };
    },
    optionList: [],
  };

  search = {
    load: async (keyword, options, page) => {
      const url = `${this.api}/index.php?m=search&key=${encodeURIComponent(keyword)}`;
      const html = await this.fetchText(url, this.api + "/", false);
      const comics = this._parseList(html);
      return { comics, maxPage: 1 };
    },
  };

  comic = {
    loadInfo: async (id) => {
      const url = `${this.api}/${id}`;
      const html = await this.fetchText(url, this.api + "/", false);
      const titleM = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
      const coverM =
        html.match(/<div class="manga-img[^"]*"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"/i) ||
        html.match(/<img[^>]+src="([^"]+)"[^>]*class="[^"]*cover[^"]*"/i);
      const descM = html.match(/<div[^>]*class="[^"]*text[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
      const chapters = new Map();
      // 章节链接形如 /<漫画数字id>/<章节id>.html；key 存为 "漫画id/章节id" 便于 loadEp 直接拼 URL
      const chRe = /href="(\/\d+\/(\d+)\.html)"[^>]*>([\s\S]*?)<\/a>/g;
      let m;
      const entries = [];
      while ((m = chRe.exec(html)) !== null) {
        const key = `${m[1].replace(/^\//, "").replace(/\.html$/, "")}`;
        const name = m[3].replace(/<[^>]+>/g, "").trim();
        if (name && name !== "开始阅读") entries.push([key, name]);
      }
      for (const [key, name] of this._sortedChapters(entries)) chapters.set(key, name);
      return new ComicDetails({
        title: titleM ? titleM[1].replace(/<[^>]+>/g, "").trim() : id,
        cover: coverM ? this._abs(coverM[1] || "", this.api) : "",
        chapters,
        tags: {},
        description: descM ? descM[1].replace(/<[^>]+>/g, "").trim() : "",
      });
    },

    loadEp: async (comicId, epId) => {
      // epId 形如 "235941/57614"
      const parts = epId.split("/");
      const cid = parts.length > 1 ? parts[0] : comicId;
      const chid = parts.length > 1 ? parts[1] : epId;
      const url = `${this.api}/${cid}/${chid}.html`;
      const html = await this.fetchText(url, `${this.api}/${cid}`, false);
      const dataM =
        html.match(/var\s+DATA\s*=\s*'([^']+)'/) ||
        html.match(/var\s+DATA\s*=\s*"([^"]+)"/);
      const cidM = html.match(/var\s+cid=(\d+)/);
      if (!dataM) {
        throw "章节图片数据缺失（DATA）";
      }
      const decryptCid = cidM ? parseInt(cidM[1], 10) : parseInt(chid, 10);
      // 站点偶发更换 key 表映射：依次尝试全部 key，直到解出合法图片列表
      let images = [];
      let lastErr = "";
      for (let ki = 0; ki < this.decryptKeys.length; ki++) {
        const key = this.decryptKeys[(decryptCid + ki) % this.decryptKeys.length];
        try {
          const bytes = new Uint8Array(Convert.decodeBase64(dataM[1]));
          const keyBytes = new Uint8Array(Convert.encodeUtf8(key));
          for (let i = 0; i < bytes.length; i++) {
            bytes[i] ^= keyBytes[i & 7];
          }
          const b64Json = Convert.decodeUtf8(bytes);
          if (b64Json == null) throw "utf8 解码失败";
          const jsonBytes = Convert.decodeBase64(b64Json);
          const json = Convert.decodeUtf8(jsonBytes);
          if (json == null) throw "utf8 解码失败";
          const list = JSON.parse(json);
          const cand = Array.isArray(list)
            ? list.map((x) => (typeof x === "string" ? x : x && x.url)).filter(Boolean)
            : [];
          if (cand.length) {
            images = cand;
            break;
          }
        } catch (e) {
          lastErr = e && e.message ? e.message : String(e);
        }
      }
      if (images.length === 0) throw "章节图片解密结果为空";
      if (lastErr) log("warning", this.name, "解密兜底：" + lastErr);
      // 原图源 s2.bzcdn.net 在部分网络下不可达，替换为可达的 baozimh 静态域名（路径一致）
      return { images: images.map((u) => u.replace(/^https?:\/\/s2\.bzcdn\.net\//i, "https://static-tw.baozimh.com/")) };
    },
  };
}
