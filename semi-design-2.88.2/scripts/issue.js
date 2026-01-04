const axios = require("axios");
const lodash = require("lodash");
const fs = require("fs");


const accessTokens = "xxx";
const main = async () => {
    const getIssues = async (pageNum, since) => {
        console.log("trying get issue page", pageNum);
        const res = await axios.get(`https://api.github.com/repos/DouyinFE/semi-design/issues`, {
            params: {
                since,
                page: pageNum,
                state: "all",
            },
            headers: {
                Authorization: `Bearer ${accessTokens}`
            }
        });
        if (res.status !== 200 || !res.data || res.data.length===0) {
            return null;
        }
        return res.data;
    };

    let list = [];

    const since = "2023-01-01";
    let currentPage = 1;
    while (true) {
        const data = await getIssues(currentPage, since);
        if (data) {
            list = [...list, ...data];
        } else {
            break;
        }
        currentPage++;

    }

    console.log(`Find ${list.length} updated issues since ${since}`);

    const result = {};

    const whichQ = (dateRaw) => {
        const date = new Date(dateRaw);
        const month = date.getMonth() + 1;
        return Math.ceil(month / 3);

    };

    list.forEach(issue => {
        const createdAt = issue['created_at'];
        const closedAt = issue['closed_at'];
        (()=>{
            if (new Date(createdAt).getFullYear()!== new Date().getFullYear()) {
                return;
            }
            const tmp = lodash.get(result, [`q${whichQ(createdAt)}`, "created"], []);
            tmp.push(issue);
            lodash.set(result, [`q${whichQ(createdAt)}`, "created"], tmp);
        })();
         
        if (closedAt!==null) {
            (()=>{
                if (new Date(closedAt).getFullYear()!== new Date().getFullYear()) {
                    return;
                }
                const tmp = lodash.get(result, [`q${whichQ(closedAt)}`, "closed"], []);
                tmp.push(issue);
                lodash.set(result, [`q${whichQ(closedAt)}`, "closed"], tmp);
            })();
        }
    });


    fs.writeFileSync("./output.json", JSON.stringify(list, null, "    "));
    Object.entries(result).forEach(([q, data])=>{
        console.log(`${q}: created ${data.created.length}   closed ${data.closed.length}`);
    });
};


main();
