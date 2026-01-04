const axios = require("axios");
const fastXML = require("fast-xml-parser");
const fs = require("fs/promises");
const execa = require("execa");
const xmlPath = "./sitemap.xml";


const getData = async ()=>{
    const xmlRaw = await fs.readFile(xmlPath, "utf8");
    const { XMLParser, XMLBuilder, XMLValidator } = fastXML;
    const parser = new XMLParser({
        ignoreAttributes: false,
        ignoreNameSpace: false,
    });
    let jsObj = parser.parse(xmlRaw);

    return jsObj;
};

const writeData = async (jsObj)=>{
    const { XMLBuilder } = fastXML;
    const builder = new XMLBuilder({
        indentBy: "    ",
        format: true,
        ignoreAttributes: false,
        ignoreNameSpace: false,
    });
    const xmlContent = builder.build(jsObj);
    await fs.writeFile(xmlPath, xmlContent);
}; 


const main = async ()=>{
    const data = await getData();
    const urlMap = {};
    data['urlset'].url.forEach(item=>{
        urlMap[item.loc] = item;
    });
    const promiseList = [];
    let count = 0;
    const urls = Object.keys(urlMap);
    const updatedArr = [];
    urls.forEach((url)=>{
        const item = urlMap[url];
        promiseList.push(new Promise(async (resolve, reject)=>{
            try {
                if (!url.startsWith("https://semi.design")) {
                    console.log(`SiteMap jump over ${url}  ${count}/${urls.length}`);
                    count++;
                    resolve();
                    return;
                }
                const res = await axios.get(url);
                if (url.startsWith("https://semi.design/zh-CN") || url.startsWith("https://semi.design/en-US")) {
                    const lang = url.startsWith("https://semi.design/zh-CN") ? "zh-CN" : "en-US";
                    const mdRelativePath = url.replace(`https://semi.design/${lang}/`, "");
                    const mdPath = `./content/${mdRelativePath}/${lang==="zh-CN"?"index.md":"index-en-US.md"}`;
                    const seconds = execa.commandSync(`echo $(git log -1 --pretty="format:%ct" ${mdPath})`, { shell: true }).stdout;
                    item.lastmod = new Date(seconds * 1000).toISOString();
                } else {
                    const scm = res.headers['X-Deploy-Scm-Version'] || res.headers['X-Deploy-Scm-Version'.toLowerCase()] || res.headers['X-Deploy-Scm-Version'.toUpperCase()];
                    if (item['scm'] && item['scm']!==scm || !item['scm']) {
                        item['scm'] = scm;
                        item.lastmod = new Date().toISOString();
                    }
                }
                count++;
                console.log(`SiteMap processed ${url}  ${count}/${urls.length}`);
                resolve();
            } catch (e) {
                reject(e);
            }
        }).catch(e=>{
            console.log("error", e, url);
        }).finally(()=>{
            updatedArr.push(item);
        }));
    });
    await Promise.all(promiseList);
    updatedArr.sort((itemA, itemB)=>{
        return itemA.loc.localeCompare(itemB.loc);
    });
    data['urlset'].url = updatedArr;
    await writeData(data);
};

main();
