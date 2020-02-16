import Axios from "axios";

export function getCookie(a) {
    let b = document.cookie.match("(^|[^;]+)\\s*" + a + "\\s*=\\s*([^;]+)");
    return b ? b.pop() : "";
}

export class WHReplay {
    constructor(baseUrl, errorCallback) {
        this.ax = Axios.create({
            baseURL: baseUrl, // TODO
            timeout: 6000,
            withCredentials: true
        });
        this.errorFunc = errorCallback
    }
    
    async errCheckedJsonReq(config){
        try {
            const resp = await this.ax.request(config);
            return resp;
        }
        catch (e) {
            let errMsg;
            if (e.response) {
                errMsg = `Server returned status ${e.response.status}: ${e.response.statusText} with data ${JSON.stringify(e.response.data)}`;
            }
            else if (e.request) {
                errMsg = "The request was made but no response was received";
            }
            else {
                errMsg = `Unable to set up request: ${e.message}`;
            }
            
            const fullErrorString = `Error: Request to ${config.url} failed. ${errMsg}`;
            this.errorFunc(fullErrorString);
        }
    }

    async register() {
        return await this.errCheckedJsonReq({method: "POST", url: "/register"});
    }

    async getRequests() {
        return await this.errCheckedJsonReq({method: "GET", url: "/requests"});
    }

    async sendReplay(reqId, replayUrl) {
        const payload = {
            "request_id": reqId,
            "endpoint": replayUrl
        };
        return await this.errCheckedJsonReq({method: "POST", url: "/replay",  data: payload})

    }

}
