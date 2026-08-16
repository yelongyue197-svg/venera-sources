/** @type {import('./_venera_.js')} */
class MiaoQu extends ComicSource {
  // 妙趣漫画（MCCMS）：国内可直连，移动端页面服务端渲染，章节图片为 XOR+Base64 加密
  name = "妙趣漫画";
  key = "miaoqu";
  version = "1.0.8";
  minAppVersion = "1.4.0";
  url = "https://yelongyue197-svg.github.io/venera-sources/miaoqu.js";
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
      let lastErr = "";
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const resp = await Network.get(url, { ...headers, Referer: referer || this.api + "/" });
          if (resp.status === 200) return resp.body;
          lastErr = `HTTP ${resp.status}: ${url}`;
        } catch (e) {
          lastErr = e && e.message ? e.message : String(e);
        }
        if (attempt === 0) await new Promise((r) => setTimeout(r, 600));
      }
      throw lastErr || `请求失败：${url}`;
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

  _parseChapters(html) {
    const chapters = new Map();
    const chRe = /href="(\/\d+\/(\d+)\.html)"[^>]*>([\s\S]*?)<\/a>/g;
    let m;
    const entries = [];
    while ((m = chRe.exec(html)) !== null) {
      const key = m[1].replace(/^\//, "").replace(/\.html$/, "");
      const name = m[3].replace(/<[^>]+>/g, "").trim();
      if (name && !["开始阅读", "继续阅读下一章节", "下一章"].includes(name)) {
        entries.push([key, name]);
      }
    }
    for (const [key, name] of this._sortedChapters(entries)) chapters.set(key, name);
    return chapters;
  }

  // 纯 JS 实现，避免个别环境下应用 Convert 桥接异常导致解密失败
  _b64ToBytes(s) {
    const t = String(s || "").replace(/\s+/g, "");
    const lookup =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    const out = [];
    let buffer = 0;
    let bits = 0;
    for (let i = 0; i < t.length; i++) {
      const c = t[i];
      if (c === "=") break;
      const v = lookup.indexOf(c);
      if (v < 0) continue;
      buffer = (buffer << 6) | v;
      bits += 6;
      if (bits >= 8) {
        bits -= 8;
        out.push((buffer >> bits) & 0xff);
      }
    }
    return new Uint8Array(out);
  }

  _latin1(bytes) {
    let out = "";
    for (let i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i]);
    return out;
  }

  _bytesToUtf8(bytes) {
    let out = "";
    let i = 0;
    while (i < bytes.length) {
      const b0 = bytes[i];
      if (b0 < 0x80) {
        out += String.fromCharCode(b0);
        i++;
      } else if (b0 >= 0xc0 && b0 < 0xe0 && i + 1 < bytes.length) {
        out += String.fromCharCode(((b0 & 0x1f) << 6) | (bytes[i + 1] & 0x3f));
        i += 2;
      } else if (b0 >= 0xe0 && b0 < 0xf0 && i + 2 < bytes.length) {
        out += String.fromCharCode(
          ((b0 & 0x0f) << 12) |
            ((bytes[i + 1] & 0x3f) << 6) |
            (bytes[i + 2] & 0x3f)
        );
        i += 3;
      } else if (b0 >= 0xf0 && i + 3 < bytes.length) {
        const cp =
          ((b0 & 0x07) << 18) |
          ((bytes[i + 1] & 0x3f) << 12) |
          ((bytes[i + 2] & 0x3f) << 6) |
          (bytes[i + 3] & 0x3f);
        out += String.fromCharCode(
          0xd800 + ((cp - 0x10000) >> 10),
          0xdc00 + ((cp - 0x10000) & 0x3ff)
        );
        i += 4;
      } else {
        out += String.fromCharCode(b0);
        i++;
      }
    }
    return out;
  }

  _xorDecrypt(data, cid) {
    // 返回图片列表；失败返回 null
    const raw = this._b64ToBytes(data);
    if (raw.length === 0) return null;
    for (let ki = 0; ki < this.decryptKeys.length; ki++) {
      const key = this.decryptKeys[(cid + ki) % this.decryptKeys.length];
      try {
        const bytes = new Uint8Array(raw);
        const kb = new Uint8Array(key.length);
        for (let i = 0; i < key.length; i++) kb[i] = key.charCodeAt(i) & 0xff;
        for (let i = 0; i < bytes.length; i++) bytes[i] ^= kb[i & 7];
        const b64Json = this._latin1(bytes);
        const jsonBytes = this._b64ToBytes(b64Json);
        const json = this._bytesToUtf8(jsonBytes);
        const list = JSON.parse(json);
        const cand = Array.isArray(list)
          ? list.map((x) => (typeof x === "string" ? x : x && x.url)).filter(Boolean)
          : [];
        if (cand.length) return cand;
      } catch (e) {
        // 继续尝试下一个 key
      }
    }
    return null;
  }

  _siteDecrypt(html, data, cid) {
    // 直接执行站点自身的 pic.js 解密函数，key 表轮换也不受影响
    return (async () => {
      let picSrc = "";
      const m = html.match(/<script[^>]+src="([^"]*pic\.js[^"]*)"/i);
      if (m) {
        picSrc = this._abs(m[1], this.api);
      } else {
        picSrc = `${this.api}/template/pc/tiantangmanhua/js/pic.js`;
      }
      const js = await this.fetchText(picSrc, this.api + "/", false);
      // 提供站点脚本运行所需的最小环境
      const g = typeof globalThis !== "undefined" ? globalThis : this;
      if (!g.atob) {
        const dec = (s) => this._latin1(this._b64ToBytes(s));
        g.atob = dec;
        g.Base64 = {
          decode: dec,
          encode: (s) => {
            // 站点脚本仅需要 decode
            return s;
          },
        };
        g.$ = () => ({ length: 0, eq: () => ({ on: () => {} }), on: () => {}, append: () => {}, hide: () => {}, show: () => {} });
        g.window = { innerHeight: 900 };
        g.document = {
          documentElement: { clientHeight: 900, clientWidth: 1200 },
          body: { scrollTop: 0, appendChild() {} },
          createElement: () => ({ src: "", onload: null }),
          getElementsByTagName: () => [{ appendChild() {} }],
        };
        g.Image = function () { this.src = ""; this.onload = null; };
      }
      const body = js + "\n;return (typeof newImgs !== 'undefined' && newImgs) ? newImgs : null;";
      let list = null;
      try {
        const fn = new Function("DATA", "cid", body);
        list = fn(data, cid);
      } catch (e1) {
        // 个别引擎不支持 new Function 时，用 eval 包裹执行
        list = eval(
          "(function(){ var DATA=" + JSON.stringify(data) + "; var cid=" + cid + "; " + body + " })()"
        );
      }
      return Array.isArray(list)
        ? list.map((x) => (typeof x === "string" ? x : x && x.url)).filter(Boolean)
        : [];
    })();
  }

  explore = [
    {
      title: this.name,
      type: "singlePageWithMultiPart",
      load: async () => {
        let html = "";
        try {
          html = await this.fetchText(this.mobile + "/", this.api + "/", true);
        } catch (e) {
          html = await this.fetchText(this.api + "/", this.api + "/", false);
        }
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
      let html = "";
      try {
        html = await this.fetchText(`${this.api}/${id}`, this.api + "/", false);
      } catch (e) {
        html = await this.fetchText(`${this.mobile}/${id}`, this.api + "/", true);
      }
      const titleM = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
      const coverM =
        html.match(/<div class="manga-img[^"]*"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"/i) ||
        html.match(/<img[^>]+src="([^"]+)"[^>]*class="[^"]*cover[^"]*"/i);
      const descM = html.match(/<div[^>]*class="[^"]*text[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
      // 章节链接形如 /<漫画数字id>/<章节id>.html；key 存为 "漫画id/章节id" 便于 loadEp 直接拼 URL
      let chapters = this._parseChapters(html);
      if (chapters.size === 0) {
        // 桌面页解析为空（可能被反爬拦截）时尝试移动端详情页
        const mhtml = await this.fetchText(`${this.mobile}/${id}`, this.api + "/", true);
        chapters = this._parseChapters(mhtml);
      }
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
      let data = null;
      let pageHtml = "";
      let decryptCid = parseInt(chid, 10);
      const tryPage = async (url, referer, mobile) => {
        const page = await this.fetchText(url, referer, mobile);
        const d = page.match(/var\s+DATA\s*=\s*'([^']+)'/) || page.match(/var\s+DATA\s*=\s*"([^"]+)"/);
        const c = page.match(/var\s+cid=(\d+)/);
        if (d) {
          data = d[1];
          pageHtml = page;
          if (c) decryptCid = parseInt(c[1], 10);
          return true;
        }
        return false;
      };
      let found = false;
      try {
        found = await tryPage(`${this.api}/${cid}/${chid}.html`, `${this.api}/${cid}`, false);
      } catch (e) {
        found = false;
      }
      if (!found) {
        found = await tryPage(`${this.mobile}/${cid}/${chid}.html`, `${this.mobile}/${cid}`, true);
      }
      if (!data) throw "章节图片数据缺失（DATA）";
      // 站点偶发更换 key 表映射：纯 JS 依次尝试全部 key，直到解出合法图片列表
      let images = this._xorDecrypt(data, decryptCid) || [];
      let lastErr = images.length ? "" : "纯 JS 解密无结果";
      if (images.length === 0) {
        // 硬编码 key 全部失败：调用站点原生解密脚本（兼容 key 表轮换）
        let siteErr = "";
        try {
          images = await this._siteDecrypt(pageHtml, data, decryptCid);
        } catch (e) {
          siteErr = e && e.message ? e.message : String(e);
          log("warning", this.name, "站点原生解密失败：" + siteErr);
        }
        if (images.length === 0) {
          throw "章节图片解密结果为空" +
            (lastErr ? "（" + lastErr + "）" : "") +
            (siteErr ? "【站点解密：" + siteErr + "】" : "");
        }
      }
      if (lastErr) log("warning", this.name, "解密兜底：" + lastErr);
      // 原图源 s2.bzcdn.net 在部分网络下不可达，替换为可达的 baozimh 静态域名（路径一致）
      return { images: images.map((u) => u.replace(/^https?:\/\/s2\.bzcdn\.net\//i, "https://static-tw.baozimh.com/")) };
    },
  };
}
