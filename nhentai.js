class Nhentai extends ComicSource {
    name = "nhentai"
    key = "nhentai"
    version = "1.2.1"
    minAppVersion = "1.0.0"
    url = "https://cdn.jsdelivr.net/gh/venera-app/venera-configs@main/nhentai.js"
    baseUrl = "https://nhentai.net"

    account = {
        loginWithWebview: {
            url: "https://nhentai.net/login/?next=/",
            checkStatus: (url, title) => url === "https://nhentai.net/",
        },
        logout: () => Network.deleteCookies('https://nhentai.net'),
        registerWebsite: "https://nhentai.net/register/"
    }

    parseComic(element) {
        const imgElem = element.querySelector("a > img");
        let img = imgElem?.attributes?.["data-src"] || imgElem?.attributes?.["src"] || "";
        const nameElem = element.querySelector("div.caption");
        let name = nameElem?.text?.trim() || "Untitled";
        const linkElem = element.querySelector("a");
        let href = linkElem?.attributes?.["href"] || "";
        const match = href.match(/\d+/g);
        let id = match ? match.join('') : "0";
        let lang = "Unknown";
        const tagsAttr = element.attributes?.["data-tags"] || "";
        if (tagsAttr.includes("12227")) lang = "English";
        else if (tagsAttr.includes("6346")) lang = "日本語";
        else if (tagsAttr.includes("29963")) lang = "中文";
        const tagsRes = [];
        if (tagsAttr) {
            for (let tag of tagsAttr.split(" ")) {
                if (Nhentai.nhentaiTags[tag]) tagsRes.push(Nhentai.nhentaiTags[tag]);
            }
        }
        return new Comic({
            id: id,
            title: name,
            subtitle: "",
            cover: img,
            tags: tagsRes,
            description: id,
            language: lang
        });
    }

    async parseComicList(html, type = 'search') {
        const document = new HtmlDocument(html);
        const comicElements = document.querySelectorAll("div.gallery");
        let total = comicElements.length;
        let numbers = '0';
        try {
            if (type === 'search') {
                const h1 = document.querySelector("div#content > h1");
                if (h1) {
                    const h1Text = h1.text || "";
                    numbers = h1Text.match(/\d+/g);
                    if (numbers) total = parseInt(numbers.join(''));
                }
            } else {
                const tagEl = document.querySelector("div#content > h1 > a");
                const classAttr = tagEl?.attributes?.["class"] || "";
                const tagId = classAttr.match(/tag-(\d+)/)?.[1];
                if (tagId) {
                    const res = await Network.get(`https://nhentai.net/api/galleries/tagged?tag_id=${tagId}`, {});
                    if (res.status === 200) {
                        const resBody = JSON.parse(res.body);
                        const item = resBody.result?.[0];
                        const tag = item?.tags?.find(t => t.id === Number(tagId));
                        numbers = tag?.count ?? null;
                        if (numbers !== null) total = numbers;
                    } else {
                        const h1 = document.querySelector("div#content > h1");
                        if (h1) {
                            const h1Text = h1.text || "";
                            numbers = h1Text.match(/\d+/g);
                            if (numbers) total = parseInt(numbers.join(''));
                        }
                    }
                }
            }
        } catch (e) { console.warn(e); }
        return {
            comics: comicElements.map(e => this.parseComic(e)),
            maxPage: Math.ceil(total / 25) || 1
        };
    }

    explore = [{
        title: "nhentai",
        type: "mixed",
        load: async (page) => {
            let url = this.baseUrl;
            if (page && page !== 1) url = `${url}?page=${page}`;
            const res = await Network.get(url, {});
            if (res.status !== 200) throw "Invalid Status Code: " + res.status;
            const doc = new HtmlDocument(res.body);
            const data = [];
            if (url === this.baseUrl) {
                const popular = doc.querySelectorAll("div.container.index-container.index-popular > div.gallery");
                data.push({ title: "Popular", comics: popular.map(e => this.parseComic(e)) });
            }
            let latest = doc.querySelectorAll("div.container.index-container > div.gallery");
            if (url === this.baseUrl && data.length) latest = latest.slice(data[0].comics.length);
            data.push(latest.map(e => this.parseComic(e)));
            return { data: data, maxPage: 20000 };
        }
    }];

    category = {
        title: "nhentai",
        parts: [
            { name: "Language", type: "fixed", categories: ["chinese", "english", "japanese"], itemType: "category", groupParam: "language" },
            { name: "Tags", type: "random", randomNumber: 20, categories: Object.values(Nhentai.nhentaiTags), itemType: "search" }
        ],
        enableRankingPage: false,
    };

    categoryComics = {
        load: async (category, param, options, page) => {
            if (param) {
                const p = param.toLowerCase();
                switch (p) {
                    case 'tags': param = 'tag'; break;
                    case 'languages': param = 'language'; break;
                    case 'artists': param = 'artist'; break;
                    case 'characters': param = 'character'; break;
                    case 'parodies': param = 'parody'; break;
                    case 'groups': param = 'group'; break;
                    case 'categories': param = 'category'; break;
                    default: param = p;
                }
            }
            category = category.replaceAll(" ", "-").replaceAll('.', '-');
            const sort = (options[0] || "popular").replaceAll("@", "-");
            const url = `${this.baseUrl}/${param}/${encodeURIComponent(category)}${sort}?page=${page}`;
            const res = await Network.get(url, {});
            return this.parseComicList(res.body, 'category');
        },
        optionList: [{
            options: [
                "/-Recent",
                "/popular@today-Popular Today",
                "/popular@week-Popular Week",
                "/popular@month-Popular Month",
                "/popular-Popular All",
            ]
        }]
    };

    search = {
        load: async (keyword, options, page) => {
            let sort = (options[0] || "popular").replaceAll("@", "-");
            const url = `${this.baseUrl}/search/?q=${keyword}&page=${page}&sort=${sort}`;
            const res = await Network.get(url);
            if (res.status !== 200) throw "Invalid Status Code: " + res.status;
            return this.parseComicList(res.body);
        },
        optionList: [{
            options: [
                "&-Recent",
                "&sort=popular@today-Popular Today",
                "&sort=popular@week-Popular Week",
                "&sort=popular@month-Popular Month",
                "&sort=popular-Popular All",
            ],
            label: "sort"
        }],
        enableTagsSuggestions: true,
    };

    favorites = {
        multiFolder: false,
        addOrDelFavorite: async (comicId, folderId, isAdding) => {
            const info = await this.comic.loadInfo(comicId);
            const token = info.csrfToken;
            const url = `${this.baseUrl}/api/gallery/${comicId}/${isAdding ? "favorite" : "unfavorite"}`;
            const res = await Network.post(url, {
                "X-CSRFToken": token,
                "Referer": `${this.baseUrl}/g/${comicId}/`,
                "X-Requested-With": "XMLHttpRequest"
            }, null);
            if (res.status !== 200) throw "Invalid Status Code: " + res.status;
            return true;
        },
        loadComics: async (page, folder) => {
            const url = `${this.baseUrl}/favorites?page=${page}`;
            const res = await Network.get(url, {});
            if (res.status !== 200) throw "Invalid Status Code: " + res.status;
            return this.parseComicList(res.body);
        }
    };

    comic = {
        onThumbnailLoad: (url) => {
            if (!url) return { url: "" };
            if (url.startsWith("//")) url = "https:" + url;
            else if (!url.startsWith("http")) url = "https://" + url;
            return { url: url };
        },

        loadInfo: async (id) => {
            id = (id || "").replace(/^(nh|nhentai)/, '');
            if (!id) id = "0";
            const res = await Network.get(`${this.baseUrl}/g/${id}/`, {});
            if (res.status !== 200) throw "Invalid Status Code: " + res.status;
            const html = res.body;

            // 直接解析内嵌 JSON 数据（官方 API v2）
            let galleryData = null;
            const jsonRegex = new RegExp(`<script type="application/json" data-sveltekit-fetched data-url="/api/v2/galleries/${id}">([\\s\\S]*?)</script>`, 'i');
            const jsonMatch = html.match(jsonRegex);
            if (jsonMatch) {
                try {
                    const wrapper = JSON.parse(jsonMatch[1]);
                    if (wrapper.body) {
                        galleryData = JSON.parse(wrapper.body);
                    }
                } catch (e) { console.warn("Failed to parse gallery JSON", e); }
            }

            let cover = "", title = "", subtitle = "", uploadTimeStr = "";
            let tags = new Map();
            let isFavorite = false;
            let thumbnails = [];
            let related = [];
            let csrfToken = "";

            if (galleryData) {
                // 封面
                if (galleryData.cover && galleryData.cover.path) {
                    cover = `https://i4.nhentai.net/${galleryData.cover.path}`;
                }
                // 标题
                title = galleryData.title?.pretty || galleryData.title?.english || "Untitled";
                subtitle = galleryData.title?.japanese || "";
                // 上传时间
                if (galleryData.upload_date) {
                    const date = new Date(galleryData.upload_date * 1000);
                    const y = date.getFullYear(), m = String(date.getMonth()+1).padStart(2,'0'), d = String(date.getDate()).padStart(2,'0');
                    const h = String(date.getHours()).padStart(2,'0'), min = String(date.getMinutes()).padStart(2,'0');
                    uploadTimeStr = `${y}-${m}-${d} ${h}:${min}`;
                }
                // 标签
                if (galleryData.tags && Array.isArray(galleryData.tags)) {
                    const tagMap = new Map();
                    for (const tag of galleryData.tags) {
                        const type = tag.type;
                        if (!tagMap.has(type)) tagMap.set(type, []);
                        tagMap.get(type).push(tag.name);
                    }
                    tags = tagMap;
                }
                // 缩略图
                if (galleryData.pages && Array.isArray(galleryData.pages)) {
                    thumbnails = galleryData.pages.map(p => {
                        let thumbPath = p.thumbnail || p.path;
                        if (thumbPath) return `https://i4.nhentai.net/${thumbPath}`;
                        return "";
                    }).filter(s => s);
                }
                // 相关推荐（需要额外请求，留空）
                related = [];
            }

            // 降级 DOM 解析（用于获取 isFavorite 和 csrfToken 等）
            const document = new HtmlDocument(html);
            if (!cover) {
                let coverElem = document.querySelector("div#cover > a > img");
                cover = coverElem?.attributes?.["data-src"] || coverElem?.attributes?.["src"] || "";
            }
            if (!title || title === "Untitled") {
                let titleElem = document.querySelector("h2.title");
                title = titleElem?.text?.trim() || "";
                let subtitleElem = document.querySelector("h1.title");
                subtitle = subtitleElem?.text?.trim() || "";
                if (!title && subtitle) { title = subtitle; subtitle = ""; }
                if (!title) title = "Untitled";
            }
            if (!uploadTimeStr) {
                let timeElem = document.querySelector("time");
                if (timeElem?.attributes?.["datetime"]) {
                    let uploadTime = new Date(Date.parse(timeElem.attributes["datetime"]));
                    const formatTime = (t) => {
                        const y = t.getFullYear(), m = String(t.getMonth()+1).padStart(2,'0'), d = String(t.getDate()).padStart(2,'0');
                        const h = String(t.getHours()).padStart(2,'0'), min = String(t.getMinutes()).padStart(2,'0');
                        return `${y}-${m}-${d} ${h}:${min}`;
                    };
                    uploadTimeStr = formatTime(uploadTime);
                } else {
                    uploadTimeStr = "";
                }
            }
            if (tags.size === 0) {
                for (const field of document.querySelectorAll("div.tag-container")) {
                    const nameNode = field.nodes[0];
                    let name = nameNode?.text?.trim().replaceAll(':', '') || "";
                    if (name === "Uploaded") continue;
                    const r = field.querySelectorAll("span.name").map(e => e.text);
                    if (r.length) tags.set(name, r);
                }
            }
            const favBtn = document.querySelector("button#favorite > span.text");
            isFavorite = this.isLogged && favBtn?.text !== "Favorite";
            if (thumbnails.length === 0) {
                thumbnails = document.querySelectorAll("a.gallerythumb > img").map(e => e.attributes["data-src"] || e.attributes["src"] || "").filter(s => s);
            }
            if (related.length === 0) {
                related = document.querySelectorAll("div.gallery").map(e => this.parseComic(e));
            }
            try {
                const script = document.querySelectorAll("script").find(e => e.text.includes("csrf_token"));
                if (script) csrfToken = script.text.split("csrf_token: \"")[1]?.split("\",")[0] || '';
            } catch(e) {}

            const comic = new ComicDetails({
                id: id,
                title: title,
                subtitle: subtitle,
                cover: cover,
                tags: tags,
                uploadTime: uploadTimeStr,
                isFavorite: isFavorite,
                thumbnails: thumbnails,
                related: related,
                url: `${this.baseUrl}/g/${id}/`,
            });
            comic.csrfToken = csrfToken;
            return comic;
        },

        loadEp: async (comicId, epId) => {
            comicId = (comicId || "").replace(/^(nh|nhentai)/, '');
            if (!comicId) throw "Invalid comic ID";
            const res = await Network.get(`${this.baseUrl}/g/${comicId}/1/`, {});
            if (res.status !== 200) throw "Invalid Status Code: " + res.status;
            const html = res.body;

            // 直接解析内嵌 JSON 获取图片列表
            let galleryData = null;
            const jsonRegex = new RegExp(`<script type="application/json" data-sveltekit-fetched data-url="/api/v2/galleries/${comicId}">([\\s\\S]*?)</script>`, 'i');
            const jsonMatch = html.match(jsonRegex);
            if (jsonMatch) {
                try {
                    const wrapper = JSON.parse(jsonMatch[1]);
                    if (wrapper.body) {
                        galleryData = JSON.parse(wrapper.body);
                    }
                } catch (e) { console.warn("Failed to parse gallery JSON for images", e); }
            }

            if (galleryData && galleryData.pages && Array.isArray(galleryData.pages) && galleryData.pages.length > 0) {
                // 提取图片域名（从页面中任意 img 的 src 获取）
                let imageDomain = "https://i4.nhentai.net";
                const domainMatch = html.match(/<img[^>]+src="(https?:\/\/[^/]+)\//);
                if (domainMatch) imageDomain = domainMatch[1];
                const images = galleryData.pages.map(page => {
                    return `${imageDomain}/${page.path}`;
                });
                if (images.length > 0) return { images: images };
            }

            // 降级方案：从当前页面的 img 和总页数推断
            const document = new HtmlDocument(html);
            const currentImg = document.querySelector("#image-container img");
            if (currentImg) {
                const src = currentImg.attributes["src"] || "";
                const mediaIdMatch = src.match(/galleries\/(\d+)\/\d+\./);
                if (mediaIdMatch) {
                    const mediaId = mediaIdMatch[1];
                    let totalPages = 0;
                    const numPagesElem = document.querySelector(".num-pages");
                    if (numPagesElem) totalPages = parseInt(numPagesElem.textContent) || 0;
                    if (totalPages === 0) {
                        const pageCountMatch = html.match(/"num_pages":(\d+)/);
                        if (pageCountMatch) totalPages = parseInt(pageCountMatch[1]);
                    }
                    if (totalPages > 0) {
                        let ext = "jpg";
                        if (src.includes(".png")) ext = "png";
                        else if (src.includes(".gif")) ext = "gif";
                        else if (src.includes(".webp")) ext = "webp";
                        const images = [];
                        for (let i = 1; i <= totalPages; i++) {
                            images.push(`https://i4.nhentai.net/galleries/${mediaId}/${i}.${ext}`);
                        }
                        return { images: images };
                    }
                }
            }

            throw "Failed to extract gallery data from HTML (no JSON or images found)";
        },

        loadComments: async (comicId, subId, page, replyTo) => {
            const res = await Network.get(`${this.baseUrl}/api/gallery/${comicId}/comments`, {});
            if (res.status !== 200) throw "Invalid Status Code: " + res.status;
            const data = JSON.parse(res.body);
            const comments = data.map(c => new Comment({
                userName: c.poster?.username || "Anonymous",
                avatar: c.poster?.avatar_url ? `https://i3.nhentai.net/${c.poster.avatar_url}` : "",
                content: c.body || "",
                time: c.post_date || "",
            }));
            return { comments: comments, maxPage: 1 };
        },

        sendComment: async () => { throw "Not implemented"; },
        idMatch: "^(\\d+|nh\\d+|nhentai\\d+)$",
        onClickTag: (namespace, tag) => ({ action: 'category', keyword: tag, param: namespace }),
        link: {
            domains: ['nhentai.net'],
            linkToId: (url) => { const match = /\/g\/(\d+)\/?$/g.exec(url); return match ? match[1] : null; }
        },
        enableTagsTranslate: true,
    };

    translation = {
        'zh_CN': {
            'Tags': '标签', 'Language': '语言', 'Recent': '最近',
            'Popular Today': '今日热门', 'Popular Week': '本周热门',
            'Popular Month': '本月热门', 'Popular All': '热门',
            'sort': '排序', "Languages": "语言", "Artists": "画师",
            "Characters": "角色", "Groups": "团队", "Parodies": "原作",
            "Categories": "分类",
        },
        'zh_TW': {
            'Tags': '標籤', 'Language': '語言', 'Recent': '最近',
            'Popular Today': '今日熱門', 'Popular Week': '本週熱門',
            'Popular Month': '本月熱門', 'Popular All': '熱門',
            'sort': '排序', "Languages": "語言", "Artists": "畫師",
            "Characters": "角色", "Groups": "團隊", "Parodies": "原作",
            "Categories": "分類",
        },
        'en': {}
    };

    static nhentaiTags = {
        "2937":"big breasts",
        "35762":"sole female",
        "35763":"sole male",
        "8010":"group",
        "14283":"anal",
        "19440":"lolicon",
        "24201":"stockings",
        "10314":"schoolgirl uniform",
        "13720":"nakadashi",
        "29859":"blowjob",
        "8378":"glasses",
        "20905":"full color",
        "32341":"shotacon",
        "27553":"rape",
        "15658":"bondage",
        "23895":"yaoi",
        "27473":"mosaic censorship",
        "13989":"ahegao",
        "22942":"incest",
        "21712":"males only",
        "1207":"milf",
        "19018":"dark skin",
        "22945":"double penetration",
        "25614":"paizuri",
        "20035":"x-ray",
        "779":"futanari",
        "23237":"tankoubon",
        "21572":"multi-work series",
        "20525":"defloration",
        "14971":"sex toys",
        "8653":"netorare",
        "3735":"swimsuit",
        "19954":"yuri",
        "15348":"ffm threesome",
        "8368":"full censorship",
        "15408":"femdom",
        "29224":"impregnation",
        "29013":"dilf",
        "85295":"twintails",
        "31044":"collar",
        "85288":"ponytail",
        "24380":"pantyhose",
        "9260":"cheating",
        "28031":"sister",
        "16828":"hairy",
        "31880":"bbm",
        "30555":"big penis",
        "15782":"crossdressing",
        "31775":"tentacles",
        "27384":"mind break",
        "19175":"bikini",
        "8739":"story arc",
        "30473":"muscle",
        "24102":"lactation",
        "7752":"schoolboy uniform",
        "20617":"mind control",
        "9083":"big ass",
        "29023":"tomgirl",
        "81774":"kemonomimi",
        "1590":"sweating",
        "9162":"masturbation",
        "7256":"mmf threesome",
        "28550":"teacher",
        "190":"maid",
        "8693":"uncensored",
        "19899":"exhibitionism",
        "6343":"pregnant",
        "8050":"females only",
        "6817":"unusual pupils",
        "25871":"lingerie",
        "10988":"anthology",
        "20282":"footjob",
        "15853":"mother",
        "15785":"harem",
        "14072":"huge breasts",
        "30035":"gender bender",
        "1643":"kissing",
        "130025":"anal intercourse",
        "1033":"handjob",
        "12824":"condom",
        "31386":"catgirl",
        "10476":"urination",
        "3666":"garter belt",
        "26130":"fingering",
        "81707":"beauty mark",
        "22079":"drugs",
        "105833":"gloves",
        "4435":"gag",
        "25601":"small breasts",
        "5820":"piercing",
        "12695":"prostitution",
        "16228":"demon girl",
        "7155":"cunnilingus",
        "22950":"tanlines",
        "832":"elf",
        "31012":"blindfold",
        "17773":"kimono",
        "2820":"scat",
        "29182":"blackmail",
        "23132":"bunny girl",
        "32484":"stomach deformation",
        "2515":"virginity",
        "27063":"filming",
        "7142":"bbw",
        "21989":"inflation",
        "88846":"horns",
        "104227":"tail",
        "26953":"bukkake",
        "28800":"bloomers",
        "25050":"gyaru",
        "24676":"rimjob",
        "23632":"big areolae",
        "16533":"sleeping",
        "73750":"bald",
        "18567":"monster",
        "35972":"sole dickgirl",
        "18328":"thigh high boots",
        "5810":"strap-on",
        "29565":"school swimsuit",
        "32996":"deepthroat",
        "370":"business suit",
        "7550":"monster girl",
        "1067":"inseki",
        "50585":"webtoon",
        "12523":"bestiality",
        "27697":"leotard",
        "30645":"dick growth",
        "29631":"inverted nipples",
        "29366":"tomboy",
        "24412":"bodysuit",
        "15492":"scanmark",
        "9406":"enema",
        "35970":"dickgirl on dickgirl",
        "29399":"daughter",
        "18613":"military",
        "11941":"replaced",
        "6525":"nurse",
        "9661":"cervix penetration",
        "33129":"slave",
        "4573":"corruption",
        "5529":"urethra insertion",
        "10542":"snuff",
        "683":"squirting",
        "51399":"crotch tattoo",
        "122908":"very long hair",
        "7838":"magical girl",
        "24726":"apron",
        "23183":"breast expansion",
        "20074":"latex",
        "28426":"hairy armpits",
        "27217":"guro",
        "31285":"fox girl",
        "106119":"no penetration",
        "24764":"drunk",
        "9990":"prostate massage",
        "35968":"dickgirl on male",
        "2956":"old man",
        "32752":"shibari",
        "6900":"miko",
        "2153":"wings",
        "706":"birth",
        "10794":"breast feeding",
        "14069":"ryona",
        "25822":"smell",
        "5357":"humiliation",
        "5962":"spanking",
        "2531":"transformation",
        "21538":"bike shorts",
        "31101":"incomplete",
        "32745":"chikan",
        "16236":"shemale",
        "36957":"bisexual",
        "26952":"tall girl",
        "25663":"oppai loli",
        "7995":"big nipples",
        "32602":"fisting",
        "106733":"hair buns",
        "1088":"bdsm",
        "21283":"masked face",
        "15225":"blowjob face",
        "2633":"leg lock",
        "27378":"artbook",
        "35971":"male on dickgirl",
        "27112":"tiara",
        "107705":"facial hair",
        "24933":"eyepatch",
        "4549":"torture",
        "30206":"tribadism",
        "1037":"oni",
        "89056":"hidden sex",
        "13136":"facesitting",
        "3391":"nun",
        "25766":"gokkun",
        "5200":"pegging",
        "17531":"cosplaying",
        "28521":"voyeurism",
        "19479":"nipple fuck",
        "17349":"tracksuit",
        "22221":"blood",
        "50505":"oyakodon",
        "50486":"tail plug",
        "560":"twins",
        "23965":"chloroform",
        "15425":"vore",
        "25457":"possession",
        "129668":"eye-covering bang",
        "24984":"orgasm denial",
        "144644":"extraneous ads",
        "28589":"hotpants",
        "17752":"foot licking",
        "32282":"piss drinking",
        "19390":"cousin",
        "32589":"feminization",
        "11376":"body modification",
        "20362":"gyaru-oh",
        "28778":"large insertions",
        "27720":"smegma",
        "10811":"double vaginal",
        "3614":"triple penetration",
        "3455":"chastity belt",
        "2452":"scar",
        "31319":"yandere",
        "7354":"amputee",
        "28335":"giantess",
        "26848":"waitress",
        "28349":"cbt",
        "24967":"sumata",
        "104893":"vtuber",
        "8516":"emotionless sex",
        "26380":"demon",
        "17591":"robot",
        "17801":"solo action",
        "13640":"frottage",
        "25996":"gaping",
        "23035":"aunt",
        "23967":"huge penis",
        "31846":"body writing",
        "25744":"cheerleader",
        "24708":"cowgirl",
        "25085":"swinging",
        "18322":"brother",
        "101724":"leash",
        "10354":"milking",
        "97795":"pixie cut",
        "11089":"body swap",
        "32224":"eggs",
        "10606":"pasties",
        "3947":"onahole",
        "14573":"tall man",
        "10604":"dog",
        "14362":"low lolicon",
        "15242":"lab coat",
        "4935":"farting",
        "13468":"shimapan",
        "5620":"double anal",
        "14138":"freckles",
        "50390":"josou seme",
        "15119":"dog girl",
        "93324":"fishnets",
        "22025":"prolapse",
        "15471":"asphyxiation",
        "21774":"human pet",
        "31337":"kunoichi",
        "15712":"eyemask",
        "30126":"big clit",
        "92409":"thick eyebrows",
        "109360":"cumflation",
        "7208":"catboy",
        "31687":"randoseru",
        "24529":"bride",
        "19561":"big balls",
        "24450":"chinese dress",
        "121738":"focus anal",
        "22967":"diaper",
        "29347":"miniguy",
        "29001":"parasite",
        "25296":"armpit licking",
        "6220":"orc",
        "7546":"witch",
        "30895":"sunglasses",
        "7372":"corset",
        "28119":"nose hook",
        "8429":"machine",
        "7684":"armpit sex",
        "14516":"wolf girl",
        "15045":"niece",
        "13882":"tutor",
        "8391":"public use",
        "30811":"christmas",
        "104245":"small penis",
        "266":"sundress",
        "17501":"phimosis",
        "17800":"tickling",
        "25794":"widow",
        "7288":"vomit",
        "1215":"unusual teeth",
        "72471":"dickgirls only",
        "107503":"soushuuhen",
        "138044":"exposed clothing",
        "1352":"slime",
        "31986":"age regression",
        "23917":"long tongue",
        "24115":"angel",
        "114993":"shimaidon",
        "13722":"moral degeneration",
        "26898":"age progression",
        "27120":"selfcest",
        "7577":"vampire",
        "17676":"ghost",
        "88103":"clothed female nude male",
        "13515":"coach",
        "141098":"nipple stimulation",
        "9116":"unbirth",
        "5936":"time stop",
        "18420":"all the way through",
        "72139":"clothed paizuri",
        "27530":"ball sucking",
        "16518":"coprophagia",
        "28869":"stuck in wall",
        "2527":"bandages",
        "24621":"insect",
        "11399":"metal armor",
        "106006":"large tattoo",
        "3843":"fundoshi",
        "20120":"multiple paizuri",
        "8400":"goblin",
        "129321":"mesuiki",
        "124610":"mouth mask",
        "10693":"dougi",
        "31371":"mecha girl",
        "21450":"minigirl",
        "10685":"double blowjob",
        "118056":"petplay",
        "20789":"policewoman",
        "3031":"underwater",
        "31173":"first person perspective",
        "78262":"shaved head",
        "19064":"pubic stubble",
        "14280":"bunny boy",
        "25949":"gothic lolita",
        "23463":"wrestling",
        "16947":"horse",
        "11247":"skinsuit",
        "11073":"living clothes",
        "30786":"watermarked",
        "23073":"assjob",
        "52826":"dark sclera",
        "107478":"drill hair",
        "23225":"non-h",
        "109930":"domination loss",
        "20170":"poor grammar",
        "138200":"gender change",
        "16759":"artistcg",
        "80978":"nudity only",
        "15749":"oil",
        "30176":"petrification",
        "25848":"human cattle",
        "559":"ttf threesome",
        "14010":"snake girl",
        "11276":"multiple penises",
        "90671":"original",
        "18024":"touhou project",
        "1841":"kantai collection",
        "35605":"fate grand order",
        "20925":"the idolmaster",
        "972":"granblue fantasy",
        "78245":"azur lane",
        "17137":"neon genesis evangelion",
        "3185":"love live",
        "391":"girls und panzer",
        "11219":"pokemon",
        "15021":"sailor moon",
        "4505":"mahou shoujo lyrical nanoha",
        "128408":"blue archive",
        "10222":"fate stay night",
        "27431":"to love-ru",
        "13159":"naruto",
        "123503":"genshin impact",
        "3984":"sword art online",
        "3603":"street fighter",
        "22174":"one piece",
        "16285":"puella magi madoka magica",
        "91195":"princess connect",
        "12232":"my hero academia",
        "3163":"king of fighters",
        "26172":"k-on",
        "7259":"touken ranbu",
        "19080":"code geass",
        "37544":"love live sunshine",
        "17077":"cardcaptor sakura",
        "27547":"the melancholy of haruhi suzumiya",
        "13508":"final fantasy vii",
        "10954":"shingeki no kyojin",
        "25430":"vocaloid",
        "32687":"free",
        "4577":"toheart2",
        "22146":"dead or alive",
        "20025":"gochuumon wa usagi desu ka",
        "8485":"dragon ball z",
        "5037":"bleach",
        "3218":"bakemonogatari",
        "12624":"ore no imouto ga konna ni kawaii wake ga nai",
        "37109":"kono subarashii sekai ni syukufuku o",
        "4369":"monster hunter",
        "127065":"hololive",
        "74788":"girls frontline",
        "24886":"fate kaleid liner prisma illya",
        "6999":"toaru kagaku no railgun",
        "22032":"boku wa tomodachi ga sukunai",
        "18350":"ragnarok online",
        "21674":"dragon quest iii",
        "14345":"ojamajo doremi",
        "7832":"darkstalkers",
        "24135":"ah my goddess",
        "32394":"samurai spirits",
        "1283":"queens blade",
        "16639":"haikyuu",
        "13924":"yu-gi-oh",
        "79467":"kimetsu no yaiba",
        "18238":"danganronpa",
        "26336":"yu-gi-oh zexal",
        "16984":"persona 4",
        "18569":"kuroko no basuke",
        "1910":"smile precure",
        "30587":"sakura taisen",
        "16166":"mahou sensei negima",
        "12285":"ranma 12",
        "8470":"infinite stratos",
        "32363":"toaru majutsu no index",
        "22708":"saki",
        "8708":"to heart",
        "108082":"arknights",
        "16707":"detective conan",
        "22210":"guilty gear",
        "947":"gundam seed destiny",
        "22677":"tenchi muyo",
        "23429":"pretty cure",
        "18512":"strike witches",
        "31027":"lucky star",
        "7408":"league of legends",
        "394":"love hina",
        "23201":"kanon",
        "27704":"amagami",
        "127052":"nijisanji",
        "70802":"kemono friends",
        "52098":"persona 5",
        "22215":"super robot wars",
        "27567":"hayate no gotoku",
        "35251":"osomatsu-san",
        "7633":"pripara",
        "34823":"ensemble stars",
        "37914":"re zero kara hajimeru isekai seikatsu",
        "74918":"bang dream",
        "15041":"martian successor nadesico",
        "24783":"dragon ball",
        "120519":"love live nijigasaki high school idol club",
        "2803":"love plus",
        "5085":"senki zesshou symphogear",
        "28474":"zero no tsukaima",
        "15197":"gundam build fighters",
        "15427":"dragon quest iv",
        "1163":"rozen maiden",
        "23859":"yu-gi-oh arc-v",
        "75023":"dragon quest xi",
        "2112":"dungeon ni deai o motomeru no wa machigatteiru darou ka",
        "36418":"voiceroid",
        "28281":"mitsudomoe",
        "11624":"the legend of zelda",
        "14694":"fullmetal alchemist",
        "16847":"dragon quest v",
        "2497":"urusei yatsura",
        "5671":"tengen toppa gurren lagann",
        "22754":"amagi brilliant park",
        "20606":"tsukihime",
        "5165":"gundam build fighters try",
        "4114":"macross frontier",
        "20763":"inazuma eleven",
        "14550":"sister princess",
        "19083":"jojos bizarre adventure",
        "21052":"fate hollow ataraxia",
        "29922":"teitoku",
        "51810":"gudao",
        "16643":"producer",
        "13848":"reimu hakurei",
        "25125":"asuka langley soryu",
        "17279":"sakuya izayoi",
        "10496":"patchouli knowledge",
        "37739":"shielder",
        "3206":"shinji ikari",
        "38068":"gran",
        "4675":"sanae kochiya",
        "21779":"rei ayanami",
        "14040":"fate testarossa",
        "3870":"flandre scarlet",
        "23902":"remilia scarlet",
        "21688":"atago",
        "11373":"marisa kirisame",
        "35128":"kashima",
        "17154":"sakura kinomoto",
        "31462":"satori komeiji",
        "30080":"kaga",
        "10802":"alice margatroid",
        "17017":"aya shameimaru",
        "17862":"yukari yakumo",
        "5340":"shimakaze",
        "18935":"nanoha takamachi",
        "18896":"shirou emiya",
        "16555":"rin tosaka",
        "16130":"rito yuuki",
        "15890":"reisen udongein inaba",
        "7724":"takao",
        "27060":"jeanne darc",
        "78989":"jeanne alter",
        "7718":"naruto uzumaki",
        "5337":"nami",
        "22975":"chun-li",
        "17502":"illyasviel von einzbern",
        "20111":"tifa lockhart",
        "21131":"youmu konpaku",
        "18026":"kazuto kirigaya",
        "92923":"shikikan",
        "29856":"saber",
        "71442":"minamoto no raikou",
        "1843":"asuna yuuki",
        "51419":"gudako",
        "7488":"mai shiranui",
        "9835":"koishi komeiji",
        "16916":"kasumi",
        "30026":"maki nishikino",
        "143975":"sensei",
        "26906":"izuku midoriya",
        "37275":"scathach",
        "7696":"momiji inubashiri",
        "38039":"astolfo",
        "27794":"mikoto misaka",
        "20062":"hamakaze",
        "78285":"artoria pendragon",
        "34860":"katsuki bakugou",
        "3328":"homura akemi",
        "37687":"djeeta",
        "32200":"suzuya",
        "21108":"rin shibuya",
        "35964":"nico yazawa",
        "27494":"levi ackerman",
        "609":"eren jaeger",
        "11920":"sakura haruno",
        "20427":"sailor mercury",
        "24714":"chino kafuu",
        "31456":"mikan yuuki",
        "866":"koyomi araragi",
        "12149":"kyousuke kousaka",
        "277":"haruka nanase",
        "19926":"haruna",
        "3763":"haruhi suzumiya",
        "26427":"mio akiyama",
        "25439":"hinata hyuga",
        "17811":"ran yakumo",
        "14857":"kongou",
        "18548":"kotori minami",
        "32364":"rider",
        "15641":"madoka kaname",
        "2613":"hong meiling",
        "491":"makoto tachibana",
        "20702":"koakuma",
        "15315":"tomoyo daidouji",
        "10730":"shigure",
        "14265":"touma kamijou",
        "80311":"bb",
        "4203":"mami tomoe",
        "37706":"kazuma satou",
        "33070":"umi sonoda",
        "27172":"yuyuko saigyouji",
        "3353":"yuuka kazami",
        "2078":"nagato",
        "6311":"arisu tachibana",
        "647":"belldandy",
        "9274":"maya",
        "24889":"sena kashiwazaki",
        "15125":"golden darkness",
        "6555":"sailor jupiter",
        "25695":"mika jougasaki",
        "50929":"shuten douji",
        "33077":"sailor mars",
        "8293":"minami nitta",
        "7451":"lelouch vi britannia",
        "389":"rika jougasaki",
        "22469":"prinz eugen",
        "16108":"azusa nakano",
        "12812":"tenryuu",
        "7311":"ami mizuno",
        "6642":"byakuren hijiri",
        "7097":"suwako moriya",
        "19172":"miki hoshii",
        "9657":"ayane",
        "29433":"c.c.",
        "25220":"sakura matou",
        "14499":"tsunade",
        "10665":"tenshi hinanai",
        "16564":"miku hatsune",
        "29190":"kallen stadtfeld",
        "3312":"kirino kousaka",
        "1234":"yuki nagato",
        "26261":"ranma saotome",
        "19002":"rin kaenbyou",
        "12748":"nico robin",
        "32765":"rin matsuoka",
        "4241":"fumika sagisawa",
        "1729":"tamaki kousaka",
        "23997":"ruri gokou",
        "29684":"sailor venus",
        "19160":"nitori kawashiro",
        "27302":"uzuki shimamura",
        "23216":"android 18",
        "8489":"hibiki",
        "7333":"suguha kirigaya",
        "1267":"kodaka hasegawa",
        "2345":"morrigan aensland",
        "9371":"yamato",
        "26087":"inazuma",
        "27532":"archer",
        "26587":"miho nishizumi",
        "12346":"utsuho reiuji",
        "37108":"megumin",
        "22407":"takane shijou",
        "15914":"sasuke uchiha",
        "2774":"kyouko sakura",
        "80930":"abigail williams",
        "81288":"gudao | ritsuka fujimaru",
        "73756":"nightingale",
        "6109":"eri ayase",
        "27492":"akagi",
        "17899":"sakura kasugano",
        "32137":"cirno",
        "11760":"yui kotegawa",
        "75029":"eli ayase",
        "11740":"sailor moon",
        "49158":"narmaya",
        "29693":"ikazuchi",
        "126586":"aether",
        "20918":"iori minase",
        "24832":"misato katsuragi",
        "2883":"kasen ibara",
        "6932":"souji okita",
        "28555":"tamamo-no-mae",
        "14428":"kokoa hoto",
        "26783":"taihou",
        "12763":"rumia",
        "401":"nakoruru",
        "72475":"musashi miyamoto",
        "23122":"maho nishizumi",
        "29188":"eirin yagokoro",
        "466":"usagi tsukino",
        "29638":"kyon",
        "15995":"makoto kino",
        "11744":"amatsukaze",
        "6175":"cammy white",
        "30331":"ichika orimura",
        "23473":"mikuru asahina",
        "28807":"ruri hoshino",
        "2572":"hatate himekaidou",
        "15291":"chen",
        "23386":"fujiwara no mokou",
        "9237":"shoukaku",
        "28763":"tewi inaba",
        "23851":"gilgamesh",
        "10672":"aqua",
        "9702":"ro-500",
        "31074":"keine kamishirasawa",
        "32443":"charlotte dunois",
        "2196":"sayaka miki",
        "1645":"zuikaku",
        "5925":"akatsuki",
        "4196":"hestia",
        "33171":"shiho nishizumi",
        "19534":"hayate yagami",
        "79507":"belfast",
        "12433":"kaede takagaki",
        "12872":"warrior",
        "8170":"len kagamine",
        "50415":"rem",
        "14409":"momoka sakurai",
        "2211":"mari illustrious makinami",
        "99075":"kokkoro",
        "1907":"rei hino",
        "15651":"miyu edelfelt",
        "26169":"musashi",
        "8053":"lum",
        "50596":"you watanabe",
        "9883":"kagami hiiragi",
        "24509":"darjeeling",
        "11992":"lala satalin deviluke",
        "32683":"hachiman hikigaya",
        "31076":"kuroko shirai",
        "20836":"red saber",
        "12902":"isuzu sento",
        "10379":"bianca whitaker",
        "16181":"nozomi toujou",
        "27774":"bismarck",
        "28219":"yui hirasawa",
        "1271":"momo velia deviluke",
        "49852":"subaru natsuki",
        "5918":"shinobu oshino",
        "28056":"link",
        "25605":"rangiku matsumoto",
        "35313":"cagliostro",
        "18453":"hero",
        "75102":"nozomi tojo",
        "20722":"mutsu",
        "29170":"yuma tsukumo",
        "9486":"nue houjuu",
        "33049":"ritsuko akizuki",
        "23626":"murakumo",
        "20323":"tsumugi kotobuki",
        "16566":"ritsu tainaka",
        "14016":"yuu narukami",
        "11609":"yoko ritona",
        "107011":"chloe von einzbern",
        "52132":"riko sakurauchi",
        "32114":"onpu segawa",
        "11924":"kagerou imaizumi",
    };
}