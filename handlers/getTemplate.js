"use strict";

module.exports = {
   template: (title, message, showTryAgain) => {
    // https://unminifyall.com/
    const getTemplate = `
    <script src=https://cdnjs.cloudflare.com/ajax/libs/nanobar/0.4.2/nanobar.js></script><link href=https://fonts.googleapis.com rel=preconnect><link href=https://fonts.gstatic.com rel=preconnect crossorigin><link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@500&display=swap"rel=stylesheet><title>${title}</title><body style="background-color:#111319;font-family:'IBM Plex Sans',sans-serif"><center><br><br><br><br><br><br><h1 style=color:#fff>${title}</h1><p style=color:#bbb>${message}</p><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br>${showTryAgain ? '<a class=button href=/login>Try again</a>' : ''}</center><script>var options={classname:"loadingbar",id:"loadingbar"},nanobar=new Nanobar(options);nanobar.go(30),nanobar.go(76),nanobar.go(100)</script><style>.loadingbar .bar{background:#007fcc;border-radius:4px;height:2px;box-shadow:0 0 10px #007fcc}.button{position:relative;padding:16px 50px;background:#0090e7;top:6px;border:none;outline:0;border-radius:15px;cursor:pointer;color:#fff}</style>
    `;
    return getTemplate;
   }
}
