/** @type {import('./_venera_.js')} */
class DongManLa extends ComicSource {
  // 动漫啦（原盒子漫画）：国内可直连、无广告、图片直链
  name = "动漫啦";
  key = "dongmanla";
  version = "1.0.2";
  minAppVersion = "1.4.0";
  url = "https://yelongyue197-svg.github.io/venera-sources/dongmanla.js";
  api = "https://www.dongman.la";

  init() {
    this.ua =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
    this.headers = {
      "User-Agent": this.ua,
      Referer: this.api + "/",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "zh-CN,zh;q=0.9",
    };
    this.fetchText = async (url, referer) => {
      const resp = await Network.get(url, { ...this.headers, Referer: referer || this.api + "/" });
      if (resp.status !== 200) {
        throw `HTTP ${resp.status}: ${url}`;
      }
      return resp.body;
    };
    this.logger = {
      error: (msg) => log("error", this.name, msg),
      info: (msg) => log("info", this.name, msg),
      warn: (msg) => log("warning", this.name, msg),
    };
  }

  _abs(u, base) {
    if (!u) return "";
    u = u.trim();
    if (u.startsWith("http")) return u;
    if (u.startsWith("//")) return "https:" + u;
    return base.replace(/\/+$/, "") + "/" + u.replace(/^\/+/, "");
  }

  _parseComics(html) {
    const comics = [];
    // 页面列表以 <li> 为单位；首页与分类/搜索页结构略有差异，统一按 li 分块解析
    const parts = html.split(/<li[\s>]/i);
    for (let i = 1; i < parts.length; i++) {
      const li = parts[i];
      const m = li.match(/\/manhua\/detail\/(\d+)\//);
      if (!m) continue;
      const id = m[1];
      // 标题：优先 class="title" 的 a，其次 <b> 内 a，最后取 detail 链接的非空文本
      let title = "";
      const t1 = li.match(/class="title"[^>]*>\s*<a[^>]*>([\s\S]*?)<\/a>/i);
      const t2 = li.match(/<b>\s*<a[^>]*>([\s\S]*?)<\/a>/i);
      const t3 = li.match(/<a[^>]+href="[^"]*\/manhua\/detail\/(\d+)\/"[^>]*>([\s\S]*?)<\/a>/i);
      const cand = [t1 && t1[1], t2 && t2[1], t3 && t3[2]]
        .map((x) => (x || "").replace(/<[^>]+>/g, "").trim())
        .filter((x) => x && x !== "最新");
      title = cand[0] || "";
      const img = li.match(/<img[^>]+(?:data-src|src)="([^"]+)"/i);
      const cover = img ? this._abs(img[1], this.api) : "";
      if (!title && !cover) continue;
      const statusM = li.match(/状态[:：]\s*([^<]+)/);
      const tagM = li.match(/标签[:：]\s*([^<]+)/);
      const introM = li.match(/简介[:：]\s*([^<]+)/);
      comics.push(
        new Comic({
          id,
          title,
          cover,
          subTitle: statusM ? statusM[1].trim() : "",
          tags: tagM ? tagM[1].split(",").map((s) => s.trim()).filter(Boolean) : [],
          description: introM ? introM[1].trim() : "",
          status: statusM && statusM[1].includes("连载") ? "连载中" : statusM ? "已完结" : "",
        })
      );
    }
    // 去重并合并：封面与标题可能分别出现在相邻的两个 <li> 中
    const map = new Map();
    for (const c of comics) {
      if (!map.has(c.id)) {
        map.set(c.id, c);
      } else {
        const old = map.get(c.id);
        old.title = old.title || c.title;
        old.cover = old.cover || c.cover;
        old.subTitle = old.subTitle || c.subTitle;
        old.description = old.description || c.description;
        if (!old.tags.length) old.tags = c.tags;
        if (!old.status) old.status = c.status;
      }
    }
    return [...map.values()];
  }

  _sortedChapters(entries) {
    const num = (name, key) => {
      const m1 = String(name).match(/第\s*(\d+)/);
      if (m1) return parseInt(m1[1], 10);
      const m2 = String(key).match(/\/chapter\/\d+\/(\d+)\//);
      if (m2) return parseInt(m2[1], 10);
      const m3 = String(key).match(/(\d+)/);
      return m3 ? parseInt(m3[1], 10) : 0;
    };
    return entries
      .map((e, i) => ({ e, i, n: num(e[1], e[0]) }))
      .sort((a, b) => (a.n - b.n) || (a.i - b.i))
      .map((x) => x.e);
  }

  explore = [
    {
      title: this.name,
      type: "singlePageWithMultiPart",
      load: async () => {
        const html = await this.fetchText(this.api + "/");
        const result = {};
        // 首页分区：日本漫画 / 港台漫画 / 欧美漫画 / 国产漫画 / 韩漫
        const secRe = /<div class="cy_wide_list">([\s\S]*?)<div class="cy_wide_list">|<div class="cy_wide_list">([\s\S]*)$/g;
        const sections = html.match(/<div class="cy_wide_list">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/g) || [];
        if (sections.length === 0) {
          // 兜底：整页解析
          const list = this._parseComics(html);
          if (list.length) result["热门推荐"] = list;
          return result;
        }
        for (const sec of sections) {
          const tm = sec.match(/<span>\s*<a[^>]*>([^<]+)<\/a>\s*<\/span>/i);
          const title = tm ? tm[1].trim() : "推荐";
          const list = this._parseComics(sec);
          if (list.length) result[title] = list;
        }
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
        categories: [
          "日本漫画",
          "港台漫画",
          "欧美漫画",
          "国产漫画",
          "韩漫",
          "完结",
          "连载中",
        ],
        itemType: "category",
        categoryParams: [
          "/manhua/japan/",
          "/manhua/hongkongtaiwan/",
          "/manhua/oumei/",
          "/manhua/guochan/",
          "/manhua/hanguo/",
          "/manhua/finish/",
          "/manhua/serial/",
        ],
      },
    ],
    enableRankingPage: false,
  };

  categoryComics = {
    load: async (category, param, options, page) => {
      const base = this._abs(param || "/manhua/japan/", this.api);
      const url = page <= 1 ? base : base.replace(/\/+$/, "") + "/" + page + ".html";
      const html = await this.fetchText(url, base);
      const comics = this._parseComics(html);
      return { comics, maxPage: 100 };
    },
    optionList: [],
  };

  search = {
    load: async (keyword, options, page) => {
      const url = `${this.api}/manhua/search/?key=${encodeURIComponent(keyword)}`;
      const html = await this.fetchText(url, this.api + "/");
      const comics = this._parseComics(html);
      return { comics, maxPage: 1 };
    },
  };

  comic = {
    loadInfo: async (id) => {
      const url = `${this.api}/manhua/detail/${id}/`;
      const html = await this.fetchText(url, this.api + "/");
      const titleM = html.match(/<meta property="og:title" content="([^"]*)"/i);
      const coverM = html.match(/<meta property="og:image" content="([^"]*)"/i);
      const descM = html.match(/<meta property="og:description" content="([^"]*)"/i);
      const catM = html.match(/<meta property="og:novel:category" content="([^"]*)"/i);
      const authorM = html.match(/<meta property="og:novel:author" content="([^"]*)"/i);
      const statusM = html.match(/<meta property="og:novel:status" content="([^"]*)"/i);
      const chapters = new Map();
      const chRe = /\/manhua\/chapter\/\d+\/(\d+)\/['"][^>]*title="([^"]+)"/g;
      let ch;
      const entries = [];
      while ((ch = chRe.exec(html))) {
        const cid = ch[1];
        const name = ch[2].trim();
        if (name && !name.includes("在线阅读")) entries.push([cid, name]);
      }
      for (const [cid, name] of this._sortedChapters(entries)) chapters.set(cid, name);
      const title = titleM ? titleM[1] : `漫画${id}`;
      const desc = descM
        ? descM[1].replace(/<[^>]+>/g, "").trim()
        : "";
      const tags = {};
      if (catM && catM[1]) tags["类型"] = catM[1].split(",").map((s) => s.trim());
      if (authorM && authorM[1]) tags["作者"] = [authorM[1].trim()];
      if (statusM && statusM[1]) tags["状态"] = [statusM[1].trim()];
      return new ComicDetails({
        title,
        subTitle: authorM ? authorM[1].trim() : "",
        cover: coverM ? coverM[1] : "",
        tags,
        chapters,
        description: desc,
      });
    },

    loadEp: async (comicId, epId) => {
      const url = `${this.api}/manhua/chapter/${comicId}/${epId}/`;
      const html = await this.fetchText(url, `${this.api}/manhua/detail/${comicId}/`);
      const images = [];
      const imgRe = /<img[^>]+src="(https:\/\/img\.dongman\.la\/[^"]+)"/g;
      let m;
      while ((m = imgRe.exec(html))) images.push(m[1]);
      if (images.length === 0) {
        const imgRe2 = /<img[^>]+src="([^"]+\.(?:jpg|jpeg|png|webp))"/gi;
        while ((m = imgRe2.exec(html))) {
          const u = m[1];
          if (/\.(jpg|jpeg|png|webp)$/i.test(u) && !/logo|icon|banner|avatar/i.test(u)) images.push(this._abs(u, this.api));
        }
      }
      return { images };
    },
  };
}
