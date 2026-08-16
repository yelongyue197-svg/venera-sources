/** @type {import('./_venera_.js')} */
class LiuManHua extends ComicSource {
  // 六漫画（MCCMS）：国内可直连，章节图片为 AES-128-CBC 加密，解密后得到图片列表
  name = "六漫画";
  key = "liumanhua";
  version = "1.0.6";
  minAppVersion = "1.4.0";
  url = "https://yelongyue197-svg.github.io/venera-sources/liumanhua.js";
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
  }

  _abs(u, base) {
    if (!u) return "";
    u = u.trim();
    if (/^https?:/i.test(u)) return u;
    if (u.startsWith("//")) return "https:" + u;
    return base.replace(/\/+$/, "") + "/" + u.replace(/^\/+/, "");
  }

  _chapterNum(name, idx) {
    const s = String(name);
    // "第N季/第N卷" 与 "第M话/回/章/集" 组合：按季*100000+话 排序
    const seasonM = s.match(/第\s*(\d+)\s*(?:季|卷)/);
    const epM = s.match(/第\s*(\d+)\s*(?:话|回|章|集)/);
    let n;
    if (epM) {
      const ep = parseInt(epM[1], 10);
      n = seasonM ? parseInt(seasonM[1], 10) * 100000 + ep : ep;
    } else {
      // "总N…" / "N…" / "00N" 等开头数字格式
      const m2 = s.match(/^总?(\d{1,5})/);
      n = m2 ? parseInt(m2[1], 10) : 900000 + idx;
    }
    // 上下篇微调：上排在前、下排在后
    if (/（上）|[·.\s]上$/.test(s)) n += 0.1;
    else if (/（下）|[·.\s]下$/.test(s)) n += 0.2;
    return n;
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

  _parseChapters(html) {
    const chRe = /href="(\/\d+\/(\d+)\.html)"[^>]*>([\s\S]*?)<\/a>/g;
    let m;
    const items = [];
    let idx = 0;
    while ((m = chRe.exec(html)) !== null) {
      const chid = m[2];
      const name = m[3].replace(/<[^>]+>/g, "").trim();
      if (name && !["开始阅读", "在线阅读", "继续阅读下一章节", "下一章"].includes(name)) {
        items.push({ id: chid, name, n: this._chapterNum(name, idx), idx: idx++ });
      }
    }
    // 站点偶发重复 id（同一 id 出现在不同章节名里）：保留章节号更小的那条
    const best = new Map();
    for (const it of items) {
      const prev = best.get(it.id);
      if (!prev || it.n < prev.n) best.set(it.id, it);
    }
    const sorted = [...best.values()].sort((a, b) => (a.n - b.n) || (a.idx - b.idx));
    const chapters = new Map();
    for (const it of sorted) chapters.set(it.id, it.name);
    return chapters;
  }

  // ---------- 纯 JS 解密（不依赖应用 Convert/AES 接口） ----------
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

  _aesCbcDecrypt(key, iv, ct) {
    const SBOX = new Uint8Array([
      0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76,
      0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0,
      0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7, 0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15,
      0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75,
      0x09, 0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3, 0x2f, 0x84,
      0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58, 0xcf,
      0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85, 0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8,
      0x51, 0xa3, 0x40, 0x8f, 0x92, 0x9d, 0x38, 0xf5, 0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2,
      0xcd, 0x0c, 0x13, 0xec, 0x5f, 0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19, 0x73,
      0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88, 0x46, 0xee, 0xb8, 0x14, 0xde, 0x5e, 0x0b, 0xdb,
      0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5c, 0xc2, 0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79,
      0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5, 0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08,
      0xba, 0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a,
      0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d, 0x9e,
      0xe1, 0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf,
      0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16,
    ]);
    const INV_SBOX = new Uint8Array([
      0x52, 0x09, 0x6a, 0xd5, 0x30, 0x36, 0xa5, 0x38, 0xbf, 0x40, 0xa3, 0x9e, 0x81, 0xf3, 0xd7, 0xfb,
      0x7c, 0xe3, 0x39, 0x82, 0x9b, 0x2f, 0xff, 0x87, 0x34, 0x8e, 0x43, 0x44, 0xc4, 0xde, 0xe9, 0xcb,
      0x54, 0x7b, 0x94, 0x32, 0xa6, 0xc2, 0x23, 0x3d, 0xee, 0x4c, 0x95, 0x0b, 0x42, 0xfa, 0xc3, 0x4e,
      0x08, 0x2e, 0xa1, 0x66, 0x28, 0xd9, 0x24, 0xb2, 0x76, 0x5b, 0xa2, 0x49, 0x6d, 0x8b, 0xd1, 0x25,
      0x72, 0xf8, 0xf6, 0x64, 0x86, 0x68, 0x98, 0x16, 0xd4, 0xa4, 0x5c, 0xcc, 0x5d, 0x65, 0xb6, 0x92,
      0x6c, 0x70, 0x48, 0x50, 0xfd, 0xed, 0xb9, 0xda, 0x5e, 0x15, 0x46, 0x57, 0xa7, 0x8d, 0x9d, 0x84,
      0x90, 0xd8, 0xab, 0x00, 0x8c, 0xbc, 0xd3, 0x0a, 0xf7, 0xe4, 0x58, 0x05, 0xb8, 0xb3, 0x45, 0x06,
      0xd0, 0x2c, 0x1e, 0x8f, 0xca, 0x3f, 0x0f, 0x02, 0xc1, 0xaf, 0xbd, 0x03, 0x01, 0x13, 0x8a, 0x6b,
      0x3a, 0x91, 0x11, 0x41, 0x4f, 0x67, 0xdc, 0xea, 0x97, 0xf2, 0xcf, 0xce, 0xf0, 0xb4, 0xe6, 0x73,
      0x96, 0xac, 0x74, 0x22, 0xe7, 0xad, 0x35, 0x85, 0xe2, 0xf9, 0x37, 0xe8, 0x1c, 0x75, 0xdf, 0x6e,
      0x47, 0xf1, 0x1a, 0x71, 0x1d, 0x29, 0xc5, 0x89, 0x6f, 0xb7, 0x62, 0x0e, 0xaa, 0x18, 0xbe, 0x1b,
      0xfc, 0x56, 0x3e, 0x4b, 0xc6, 0xd2, 0x79, 0x20, 0x9a, 0xdb, 0xc0, 0xfe, 0x78, 0xcd, 0x5a, 0xf4,
      0x1f, 0xdd, 0xa8, 0x33, 0x88, 0x07, 0xc7, 0x31, 0xb1, 0x12, 0x10, 0x59, 0x27, 0x80, 0xec, 0x5f,
      0x60, 0x51, 0x7f, 0xa9, 0x19, 0xb5, 0x4a, 0x0d, 0x2d, 0xe5, 0x7a, 0x9f, 0x93, 0xc9, 0x9c, 0xef,
      0xa0, 0xe0, 0x3b, 0x4d, 0xae, 0x2a, 0xf5, 0xb0, 0xc8, 0xeb, 0xbb, 0x3c, 0x83, 0x53, 0x99, 0x61,
      0x17, 0x2b, 0x04, 0x7e, 0xba, 0x77, 0xd6, 0x26, 0xe1, 0x69, 0x14, 0x63, 0x55, 0x21, 0x0c, 0x7d,
    ]);

    const xtime = (x) => ((x << 1) ^ (x & 0x80 ? 0x1b : 0)) & 0xff;
    const mul = (a, b) => {
      let r = 0;
      while (b) {
        if (b & 1) r ^= a;
        a = xtime(a);
        b >>= 1;
      }
      return r & 0xff;
    };

    // 密钥扩展（AES-128，10 轮）
    const RCON = [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36];
    const w = new Uint8Array(176);
    for (let i = 0; i < 16; i++) w[i] = key[i];
    let rconIdx = 0;
    for (let i = 4; i < 44; i++) {
      let t0 = w[(i - 1) * 4], t1 = w[(i - 1) * 4 + 1], t2 = w[(i - 1) * 4 + 2], t3 = w[(i - 1) * 4 + 3];
      if (i % 4 === 0) {
        const tmp = t0;
        t0 = SBOX[t1] ^ RCON[rconIdx++];
        t1 = SBOX[t2];
        t2 = SBOX[t3];
        t3 = SBOX[tmp];
      }
      w[i * 4] = w[(i - 4) * 4] ^ t0;
      w[i * 4 + 1] = w[(i - 4) * 4 + 1] ^ t1;
      w[i * 4 + 2] = w[(i - 4) * 4 + 2] ^ t2;
      w[i * 4 + 3] = w[(i - 4) * 4 + 3] ^ t3;
    }

    const addRoundKey = (s, round) => {
      const o = round * 16;
      for (let c = 0; c < 4; c++) {
        s[c * 4] ^= w[o + c * 4];
        s[c * 4 + 1] ^= w[o + c * 4 + 1];
        s[c * 4 + 2] ^= w[o + c * 4 + 2];
        s[c * 4 + 3] ^= w[o + c * 4 + 3];
      }
    };
    const invShiftRows = (s) => {
      let t = s[1]; s[1] = s[13]; s[13] = s[9]; s[9] = s[5]; s[5] = t;
      t = s[2]; s[2] = s[10]; s[10] = t; t = s[6]; s[6] = s[14]; s[14] = t;
      t = s[3]; s[3] = s[7]; s[7] = s[11]; s[11] = s[15]; s[15] = t;
    };
    const invSubBytes = (s) => {
      for (let i = 0; i < 16; i++) s[i] = INV_SBOX[s[i]];
    };
    const invMixColumns = (s) => {
      for (let c = 0; c < 4; c++) {
        const i = c * 4;
        const a0 = s[i], a1 = s[i + 1], a2 = s[i + 2], a3 = s[i + 3];
        s[i] = mul(a0, 14) ^ mul(a1, 11) ^ mul(a2, 13) ^ mul(a3, 9);
        s[i + 1] = mul(a0, 9) ^ mul(a1, 14) ^ mul(a2, 11) ^ mul(a3, 13);
        s[i + 2] = mul(a0, 13) ^ mul(a1, 9) ^ mul(a2, 14) ^ mul(a3, 11);
        s[i + 3] = mul(a0, 11) ^ mul(a1, 13) ^ mul(a2, 9) ^ mul(a3, 14);
      }
    };
    const decryptBlock = (s) => {
      addRoundKey(s, 10);
      for (let round = 9; round >= 1; round--) {
        invShiftRows(s);
        invSubBytes(s);
        addRoundKey(s, round);
        invMixColumns(s);
      }
      invShiftRows(s);
      invSubBytes(s);
      addRoundKey(s, 0);
    };

    const out = new Uint8Array(ct.length);
    let prev = new Uint8Array(16);
    for (let i = 0; i < 16; i++) prev[i] = iv[i];
    for (let off = 0; off < ct.length; off += 16) {
      const block = new Uint8Array(ct.subarray(off, off + 16));
      decryptBlock(block);
      for (let i = 0; i < 16; i++) block[i] ^= prev[i];
      out.set(block, off);
      prev = new Uint8Array(ct.subarray(off, off + 16));
    }
    return out;
  }

  _stripPkcs7(bytes) {
    if (!bytes || bytes.length === 0) return bytes;
    const pad = bytes[bytes.length - 1];
    if (pad >= 1 && pad <= 16 && pad <= bytes.length) {
      let valid = true;
      for (let i = bytes.length - pad; i < bytes.length; i++) {
        if (bytes[i] !== pad) { valid = false; break; }
      }
      if (valid) return bytes.slice(0, bytes.length - pad);
    }
    return bytes;
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
      let html = "";
      try {
        html = await this.fetchText(`${this.api}/${id}`, this.api + "/", false);
      } catch (e) {
        html = await this.fetchText(`${this.mobile}/${id}`, this.api + "/", true);
      }
      const titleM = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
      const coverM =
        html.match(/<div class="cy_info_cover">[\s\S]*?<img[^>]+src="([^"]+)"/i) ||
        html.match(/<div class="de-info__cover"[^>]*>[\s\S]*?<img[^>]+(?:data-src|src)="([^"]+)"/i) ||
        html.match(/<img[^>]+src="([^"]+)"[^>]*class="[^"]*cover[^"]*"/i);
      const descM = html.match(/<div[^>]*class="[^"]*text[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
      let chapters = this._parseChapters(html);
      if (chapters.size === 0) {
        // 桌面页解析为空（可能被反爬拦截）时尝试移动端详情页
        const mhtml = await this.fetchText(`${this.mobile}/${id}`, this.api + "/", true);
        chapters = this._parseChapters(mhtml);
      }
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
      const raw = this._b64ToBytes(paramsM[1]);
      if (raw.length <= 16) throw "章节图片数据不完整";
      const iv = raw.slice(0, 16);
      const ct = raw.slice(16);
      // 纯 JS AES-128-CBC 解密 + PKCS7 去填充 + UTF-8 解码（不依赖应用接口）
      const key = new Uint8Array(16);
      const ks = "9S8$vJnU2ANeSRoF";
      for (let i = 0; i < 16; i++) key[i] = ks.charCodeAt(i) & 0xff;
      const decBytes = this._stripPkcs7(this._aesCbcDecrypt(key, iv, ct));
      const jsonText = this._bytesToUtf8(decBytes);
      if (!jsonText) throw "章节图片数据解密失败";
      const obj = JSON.parse(jsonText);
      const images = Array.isArray(obj.images) ? obj.images : Array.isArray(obj) ? obj : [];
      if (images.length === 0) throw "章节图片解密结果为空";
      // 原图源 s2.bzcdn.net 在部分网络下不可达，替换为可达的 baozimh 静态域名（路径一致）
      return { images: images.map((u) => u.replace(/^https?:\/\/s2\.bzcdn\.net\//i, "https://static-tw.baozimh.com/")) };
    },
  };
}
