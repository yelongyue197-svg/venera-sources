/** @type {import('./_venera_.js')} */
class LiuManHua extends ComicSource {
  // 六漫画（MCCMS）：国内可直连，章节图片为 AES-128-CBC 加密，解密后得到图片列表
  name = "六漫画";
  key = "liumanhua";
  version = "1.0.1";
  minAppVersion = "1.4.0";
  url = "https://cdn.jsdelivr.net/gh/yelongyue197-svg/venera-sources@main/liumanhua.js";
  api = "https://www.liumanhua.com";
  mobile = "https://m.liumanhua.com";

  init() {
    this.mobileUa =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
    this.desktopUa =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
    this.desktopHeaders = {
      "User-Agent": this.desktopUa,
      Referer: this.api + "/",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "zh-CN,zh;q=0.9",
    };
    this.mobileHeaders = {
      "User-Agent": this.mobileUa,
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
      const m2 = String(key).match(/(\d+)/);
      return m2 ? parseInt(m2[1], 10) : 0;
    };
    return entries
      .map((e, i) => ({ e, i, n: num(e[1], e[0]) }))
      .sort((a, b) => (a.n - b.n) || (a.i - b.i))
      .map((x) => x.e);
  }

  _parseList(html) {
    const comics = [];
    // 桌面端列表：<li><a href="/id" class="pic"><img src=".."></a></li><li class="title"><a href="/id">标题</a></li>
    const re =
      /<li>\s*<a href="\/(\d+)"[^>]*class="pic"[^>]*>\s*<img[^>]+src="([^"]+)"[^>]*>\s*<\/a>\s*<\/li>\s*<li class="title">\s*<a href="\/\1"[^>]*>([^<]+)<\/a>/g;
    let m;
    while ((m = re.exec(html)) !== null) {
      const id = m[1];
      const cover = this._abs(m[2], this.api);
      const title = (m[3] || "").trim();
      if (!id || !title) continue;
      comics.push(new Comic({ id, title, cover }));
    }
    if (comics.length === 0) {
      // 移动端列表：<li><div class="pic"><a href="/id"><img src=".."></a></div>...<a class="name">标题</a>
      const re2 =
        /<div class="pic">\s*<a href="\/(\d+)"[^>]*>\s*<img[^>]+src="([^"]+)"[^>]*>\s*<\/a>\s*<\/div>[\s\S]*?<a href="\/\1"[^>]*class="name"[^>]*>([^<]+)<\/a>/g;
      while ((m = re2.exec(html)) !== null) {
        comics.push(new Comic({ id: m[1], title: (m[3] || "").trim(), cover: this._abs(m[2], this.api) }));
      }
    }
    if (comics.length === 0) {
      // 移动端搜索结果：<li class="comic-item"><a href="/id"><img class="cover" data-src=".."></a><div class="comic-info-box"><p class="comic-name">标题</p>
      const re3 =
        /<li class="comic-item">\s*<a href="\/(\d+)">[\s\S]*?<img[^>]+data-src="([^"]+)"[^>]*>[\s\S]*?<p class="comic-name">([^<]+)<\/p>/g;
      while ((m = re3.exec(html)) !== null) {
        comics.push(new Comic({ id: m[1], title: (m[3] || "").trim(), cover: this._abs(m[2], this.api) }));
      }
    }
    const seen = new Set();
    return comics.filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)));
  }

  explore = [
    {
      title: this.name,
      type: "singlePageWithMultiPart",
      load: async () => {
        const html = await this.fetchText(`${this.api}/category/list/1`, this.api + "/", false);
        const list = this._parseList(html);
        const result = {};
        if (list.length) result["热门漫画"] = list.slice(0, 20);
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
        categories: ["热门人气", "更新时间", "全部列表"],
        itemType: "category",
        categoryParams: ["/category/list/1/order/hits", "/category/list/1/order/addtime", "/category/list/1"],
      },
    ],
    enableRankingPage: false,
  };

  categoryComics = {
    load: async (category, param, options, page) => {
      const url = this._abs(param || "/category/list/1", this.api);
      const html = await this.fetchText(url, this.api + "/", false);
      const comics = this._parseList(html);
      return { comics, maxPage: page <= 1 ? 1 : 1 };
    },
    optionList: [],
  };

  search = {
    load: async (keyword, options, page) => {
      const url = `${this.mobile}/index.php?m=search&key=${encodeURIComponent(keyword)}`;
      const html = await this.fetchText(url, this.api + "/", true);
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
        html.match(/<div class="cy_info_cover">[\s\S]*?<img[^>]+src="([^"]+)"/i) ||
        html.match(/<div class="de-info__cover"[^>]*>[\s\S]*?<img[^>]+(?:data-src|src)="([^"]+)"/i) ||
        html.match(/<img[^>]+src="([^"]+)"[^>]*class="[^"]*cover[^"]*"/i);
      const descM = html.match(/<div[^>]*class="[^"]*text[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
      const chapters = new Map();
      const chRe = /href="(\/\d+\/(\d+)\.html)"[^>]*>([\s\S]*?)<\/a>/g;
      let m;
      const entries = [];
      while ((m = chRe.exec(html)) !== null) {
        const chid = m[2];
        const name = m[3].replace(/<[^>]+>/g, "").trim();
        if (name && name !== "在线阅读") entries.push([chid, name]);
      }
      for (const [chid, name] of this._sortedChapters(entries)) chapters.set(chid, name);
      return new ComicDetails({
        title: titleM ? titleM[1].replace(/<[^>]+>/g, "").trim() : `漫画${id}`,
        cover: coverM ? this._abs(coverM[1] || coverM[2] || "", this.api) : "",
        chapters,
        tags: {},
        description: descM ? descM[1].replace(/<[^>]+>/g, "").trim() : "",
      });
    },

    loadEp: async (comicId, epId) => {
      const url = `${this.api}/${comicId}/${epId}.html`;
      const html = await this.fetchText(url, `${this.api}/${comicId}`, false);
      const paramsM = html.match(/params\s*=\s*'([^']+)'/);
      if (!paramsM) {
        throw "章节图片数据缺失（params）";
      }
      const raw = new Uint8Array(Convert.decodeBase64(paramsM[1]));
      if (raw.length <= 16) throw "章节图片数据不完整";
      const iv = raw.slice(0, 16);
      const ct = raw.slice(16);
      const key = new Uint8Array(Convert.encodeUtf8("9S8$vJnU2ANeSRoF"));
      // 直接走引擎的 AES-CBC（Convert.decryptAesCbc 在部分版本中类型有误，改用 sendMessage）
      const dec = sendMessage({
        method: "convert",
        type: "aes-cbc",
        value: ct,
        key: key,
        iv: iv,
        isEncode: false,
      });
      const jsonText = Convert.decodeUtf8(dec);
      const obj = JSON.parse(jsonText);
      const images = Array.isArray(obj.images) ? obj.images : Array.isArray(obj) ? obj : [];
      if (images.length === 0) throw "章节图片解密结果为空";
      // 原图源 s2.bzcdn.net 在部分网络下不可达，替换为可达的 baozimh 静态域名（路径一致）
      return { images: images.map((u) => u.replace(/^https?:\/\/s2\.bzcdn\.net\//i, "https://static-tw.baozimh.com/")) };
    },
  };
}
