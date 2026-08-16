/** @type {import('./_venera_.js')} */
class DongManManHua extends ComicSource {
  // 咚漫（Webtoon 中国官方站）：国内可直连、稳定；章节图片来自官方 CDN
  name = "咚漫";
  key = "dongmanmanhua";
  version = "1.0.2";
  minAppVersion = "1.4.0";
  url = "https://yelongyue197-svg.github.io/venera-sources/dongmanmanhua.js";
  api = "https://www.dongmanmanhua.cn";

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
  }

  _abs(u, base) {
    if (!u) return "";
    u = u.trim();
    if (/^https?:/i.test(u)) return u;
    if (u.startsWith("//")) return "https:" + u;
    return base.replace(/\/+$/, "") + "/" + u.replace(/^\/+/, "");
  }

  _strip(s) {
    return (s || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  }

  _sortedChapters(entries) {
    const num = (name, key) => {
      const m1 = String(name).match(/(\d+)/);
      if (m1) return parseInt(m1[1], 10);
      const m2 = String(key).match(/episode_no=(\d+)/);
      if (m2) return parseInt(m2[1], 10);
      return 0;
    };
    return entries
      .map((e, i) => ({ e, i, n: num(e[1], e[0]) }))
      .sort((a, b) => (a.n - b.n) || (a.i - b.i))
      .map((x) => x.e);
  }

  // 列表卡片：<li><a href=".../list?title_no=N" class="daily_card_item ..."><img src=".."><div class="info"><p class="subj">标题</p>...
  _parseList(html) {
    const comics = [];
    const re =
      /<a[^>]+href="([^"]*?list\?title_no=\d+)"[^>]*class="[^"]*"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"[^>]*>[\s\S]*?<p class="subj">([^<]+)<\/p>/g;
    let m;
    while ((m = re.exec(html)) !== null) {
      const raw = m[1];
      const id = raw.startsWith("//") ? "https:" + raw : raw.startsWith("/") ? this._abs(raw, this.api) : raw;
      const title = (m[3] || "").trim();
      if (!id || !title) continue;
      comics.push(new Comic({ id, title, cover: this._abs(m[2], this.api) }));
    }
    const seen = new Set();
    return comics.filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)));
  }

  explore = [
    {
      title: this.name,
      type: "multiPageComicList",
      load: async (page) => {
        const html = await this.fetchText(this.api + "/dailySchedule");
        const comics = this._parseList(html);
        return { comics, maxPage: 1 };
      },
    },
  ];

  category = {
    title: this.name,
    parts: [
      {
        name: "星期",
        type: "fixed",
        categories: ["周一", "周二", "周三", "周四", "周五", "周六", "周日"],
        itemType: "category",
        categoryParams: [
          "_list_MONDAY",
          "_list_TUESDAY",
          "_list_WEDNESDAY",
          "_list_THURSDAY",
          "_list_FRIDAY",
          "_list_SATURDAY",
          "_list_SUNDAY",
        ],
      },
    ],
    enableRankingPage: false,
  };

  categoryComics = {
    load: async (category, param, options, page) => {
      const html = await this.fetchText(this.api + "/dailySchedule");
      const m = html.match(new RegExp(`<div class="${param}">([\\s\\S]*?)<\\/div>\\s*<\\/div>`));
      const block = m ? m[1] : html;
      const comics = this._parseList(block);
      return { comics, maxPage: 1 };
    },
    optionList: [],
  };

  search = {
    load: async (keyword, options, page) => {
      const url = `${this.api}/search?keyword=${encodeURIComponent(keyword)}&page=${page}`;
      const html = await this.fetchText(url);
      const comics = this._parseList(html);
      return { comics, maxPage: 1 };
    },
  };

  comic = {
    loadInfo: async (id) => {
      const url = this._abs(id, this.api);
      const html = await this.fetchText(url, this.api + "/");
      const titleM = html.match(/<h1[^>]*class="[^"]*subj[^"]*"[^>]*>([\s\S]*?)<\/h1>/i) ||
        html.match(/<h3[^>]*class="[^"]*subj[^"]*"[^>]*>([\s\S]*?)<\/h3>/i);
      const coverM =
        html.match(/class="[^"]*detail_body[^"]*"[^>]*style="[^"]*url\(([^)]+)\)/i) ||
        html.match(/<span[^>]*class="[^"]*thmb[^"]*"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"/i);
      const descM = html.match(/<p[^>]*class="summary"[^>]*>([\s\S]*?)<\/p>/i);
      const chapters = new Map();
      let pageHtml = html;
      const entries = [];
      for (let guard = 0; guard < 10; guard++) {
        const chRe = /<a[^>]+href="([^"]*viewer[^"]*)"[^>]*>[\s\S]*?<span class="subj">\s*<span[^>]*>([^<]+)<\/span>[\s\S]*?<\/a>/g;
        let m;
        while ((m = chRe.exec(pageHtml)) !== null) {
          const name = (m[2] || "").trim();
          if (name) entries.push([m[1], name]);
        }
        const next = pageHtml.match(/<div class="paginate">[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>/);
        if (!next) break;
        try {
          pageHtml = await this.fetchText(this._abs(next[1], this.api), url);
        } catch (e) {
          break;
        }
      }
      for (const [k, name] of this._sortedChapters(entries)) chapters.set(k, name);
      return new ComicDetails({
        title: titleM ? this._strip(titleM[1]) : id,
        cover: coverM ? this._abs(coverM[1].replace(/['"]/g, ""), this.api) : "",
        chapters,
        tags: {},
        description: descM ? this._strip(descM[1]) : "",
      });
    },

    loadEp: async (comicId, epId) => {
      const url = this._abs(epId, this.api);
      const html = await this.fetchText(url, this._abs(comicId, this.api));
      const images = [];
      const re = /<img[^>]+data-url="([^"]+)"/g;
      let m;
      while ((m = re.exec(html)) !== null) images.push(m[1]);
      if (images.length === 0) {
        const re2 = /<img[^>]+src="(https:\/\/cdn\.dongmanmanhua\.cn\/[^"]+)"/g;
        while ((m = re2.exec(html)) !== null) images.push(m[1]);
      }
      return { images };
    },
    onImageLoad: (url, comicId, epId) => {
      return { headers: { Referer: this.api + "/" } };
    },
  };
}
