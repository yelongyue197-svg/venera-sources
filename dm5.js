/** @type {import('./_venera_.js')} */
class DongManWu extends ComicSource {
  // 动漫屋：国内可直连、日漫资源全；章节图片走 chapterfun.ashx（eval 打包 JS，需解包）
  name = "动漫屋";
  key = "dm5";
  version = "1.0.5";
  minAppVersion = "1.4.0";
  url = "https://cdn.jsdelivr.net/gh/yelongyue197-svg/venera-sources@main/dm5.js";
  api = "https://www.dm5.com";

  init() {
    this.ua =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
    this.headers = {
      "User-Agent": this.ua,
      Referer: this.api + "/",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
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
      const m1 = String(name).match(/第\s*(\d+)/);
      if (m1) return parseInt(m1[1], 10);
      const m2 = String(key).match(/(\d+)/);
      return m2 ? parseInt(m2[1], 10) : 0;
    };
    return entries
      .map((e, i) => ({ e, i, n: num(e[1], e[0]) }))
      .sort((a, b) => (a.n - b.n) || (a.i - b.i))
      .map((x) => x.e);
  }

  // Dean Edwards packer 解包
  _unpack(p, a, c, k) {
    const d = {};
    let e = function (cc) {
      return (cc < a ? "" : e(parseInt(cc / a))) + ((cc = cc % a) > 35 ? String.fromCharCode(cc + 29) : cc.toString(36));
    };
    if (!"".replace(/^/, String)) {
      while (c--) d[e(c)] = k[c] || e(c);
      k = [function (ee) { return d[ee]; }];
      e = function () { return "\\w+"; };
      c = 1;
    }
    while (c--) if (k[c]) p = p.replace(new RegExp("\\b" + e(c) + "\\b", "g"), k[c]);
    return p;
  }

  _parseChapterfun(body) {
    const m = body.match(
      /function\(p,a,c,k,e,d\)\{[\s\S]*?\}\('([\s\S]*)',(\d+),(\d+),'([\s\S]*)'\)/
    );
    if (!m) {
      throw "chapterfun 返回格式异常";
    }
    const unpacked = this._unpack(m[1], parseInt(m[2], 10), parseInt(m[3], 10), m[4].split("|"));
    const pixM = unpacked.match(/var\s+pix\s*=\s*"([^"]*)"/);
    const pvM2 = unpacked.match(/var\s+pvalue\s*=\s*\[([\s\S]*?)\]/);
    const queryM = unpacked.match(/pix\+pvalue\[i\]\+\\?'([^']+)/);
    if (!pixM || !pvM2) throw "chapterfun 解包后缺少图片数据";
    const list = [];
    const re = /"([^"]+)"/g;
    let x;
    while ((x = re.exec(pvM2[1])) !== null) list.push(x[1]);
    if (!list.length) throw "chapterfun 图片列表为空";
    const pix = pixM[1];
    const query = queryM ? queryM[1].replace(/^\\+|\\+$/g, "") : "";
    return list.map((p) => `${pix}${p}${query}`);
  }

  _parseList(html) {
    const comics = [];
    const re =
      /<div class="mh-item[^"]*">\s*<p class="mh-cover[^"]*"[^>]*style="background-image:\s*url\(([^)]+)\)">[\s\S]*?<h2 class="title">\s*<a href="(\/manhua[^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
    let m;
    while ((m = re.exec(html)) !== null) {
      const cover = this._abs(m[1].replace(/^['"]|['"]$/g, ""), this.api);
      const title = this._strip(m[3]);
      const id = m[2];
      if (!title) continue;
      comics.push(new Comic({ id, title, cover }));
    }
    const seen = new Set();
    return comics.filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)));
  }

  explore = [
    {
      title: this.name,
      type: "multiPageComicList",
      load: async (page) => {
        const html = await this.fetchText(`${this.api}/manhua-list-p${page}/`, this.api + "/");
        const comics = this._parseList(html);
        return { comics, maxPage: 100 };
      },
    },
  ];

  category = {
    title: this.name,
    parts: [
      {
        name: "分类",
        type: "fixed",
        categories: ["全部漫画", "日漫", "国漫原创", "最近更新", "漫画排行"],
        itemType: "category",
        categoryParams: ["list", "jp", "original", "new", "rank"],
      },
    ],
    enableRankingPage: false,
  };

  categoryComics = {
    load: async (category, param, options, page) => {
      let url;
      if (param === "list") {
        url = `${this.api}/manhua-list-p${page}/`;
      } else {
        url = `${this.api}/manhua-${param}/`;
      }
      const html = await this.fetchText(url, this.api + "/");
      const comics = this._parseList(html);
      return { comics, maxPage: param === "list" ? 100 : 1 };
    },
    optionList: [],
  };

  search = {
    load: async (keyword, options, page) => {
      const url = `${this.api}/search?title=${encodeURIComponent(keyword)}&language=1&page=${page}`;
      const html = await this.fetchText(url, this.api + "/");
      const comics = this._parseList(html);
      return { comics, maxPage: 1 };
    },
  };

  comic = {
  loadInfo: async (id) => {
    const url = this._abs(id, this.api);
    const html = await this.fetchText(url, this.api + "/");
    // 部分漫画已被站点下架，明确提示而不是给出空章节
    if (/不再提供[^<]*在线阅读|已不再提供/.test(html) && !/<ul class="view-win-list detail-list-select"/.test(html)) {
      throw "该漫画在动漫屋已下架，无法在线阅读";
    }
    const titleM =
      html.match(/<div class="banner_detail_form">[\s\S]*?<p class="title">\s*([^<]+)/i) ||
      html.match(/<p class="title">\s*([^<]+)/i);
    const coverM = html.match(/<div class="cover">\s*<img[^>]+src="([^"]+)"/i);
    const descM = html.match(/<p class="intro">\s*([\s\S]*?)<\/p>/i);
    const chapters = new Map();
    // 兼容带 style 等属性的第二个章节区块（id 如 detail-list-select-3）
    const blockRe = /<ul class="view-win-list detail-list-select" id="detail-list-select-\d+"[^>]*>([\s\S]*?)<\/ul>/g;
    let bm;
    const entries = [];
    while ((bm = blockRe.exec(html)) !== null) {
      const chRe = /href="\/m(\d+)\/"[^>]*>\s*([\s\S]*?)<\/a>/g;
      let cm;
        while ((cm = chRe.exec(bm[1])) !== null) {
          const name = this._strip(cm[2]);
          if (name) entries.push([cm[1], name]);
        }
      }
      for (const [cid, name] of this._sortedChapters(entries)) chapters.set(cid, name);
      return new ComicDetails({
        title: titleM ? this._strip(titleM[1]) : id,
        cover: coverM ? this._abs(coverM[1], this.api) : "",
        chapters,
        tags: {},
        description: descM ? this._strip(descM[1]) : "",
      });
    },

    loadEp: async (comicId, epId) => {
      if (epId == null || epId === "" || epId === "null" || epId === "undefined") {
        throw "章节 ID 缺失：该漫画可能已下架，请从详情页重新选择章节";
      }
      const chapterUrl = `${this.api}/m${epId}/`;
      const html = await this.fetchText(chapterUrl, this._abs(comicId, this.api));
      // 部分章节图片直接内嵌
      const direct = [];
      const dRe = /<img[^>]+data-src="([^"]+\.(?:jpg|jpeg|png|webp))"/g;
      let dm;
      while ((dm = dRe.exec(html)) !== null) direct.push(this._abs(dm[1], this.api));
      if (direct.length) return { images: direct };

      const scriptM = html.match(/<script[^>]*>([\s\S]*?DM5_MID[\s\S]*?)<\/script>/);
      if (!scriptM) throw "章节页缺少图片脚本";
      const sc = scriptM[1];
      const g = (k) => {
        const m1 = sc.match(new RegExp('var\\s+' + k + '="([^"]*)"'));
        if (m1) return m1[1];
        const m2 = sc.match(new RegExp("var\\s+" + k + "=([^;]*)"));
        return m2 ? m2[1].trim() : "";
      };
      const cid = (sc.match(/var\s+DM5_CID\s*=\s*(\d+)/) || [])[1];
      const mid = g("DM5_MID");
      const dt = g("DM5_VIEWSIGN_DT");
      const sign = g("DM5_VIEWSIGN");
      const count = parseInt((sc.match(/var\s+DM5_IMAGE_COUNT\s*=\s*(\d+)/) || [])[1] || "0", 10);
      if (!cid || !count) throw "章节页缺少必要参数";
      const images = [];
      for (let i = 1; i <= count; i++) {
        const api = `${chapterUrl}chapterfun.ashx?cid=${cid}&page=${i}&key=&language=1&gtk=6&_cid=${cid}&_mid=${mid}&_dt=${encodeURIComponent(dt)}&_sign=${encodeURIComponent(sign)}`;
        const body = await this.fetchText(api, chapterUrl);
        const urls = this._parseChapterfun(body);
        images.push(urls[0]);
      }
      return { images };
    },
    onImageLoad: (url, comicId, epId) => {
      // 图片 CDN 需要携带章节页 Referer，否则返回 404
      return { headers: { Referer: `https://www.dm5.com/m${epId}/` } };
    },
  };
}
