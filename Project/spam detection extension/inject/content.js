(async () => {
  let spam_color = [255, 0, 0];

  const backgroundPort = chrome.runtime.connect({
    name: "distil-bert-port",
  });
  
  backgroundPort.onMessage.addListener(({ type, arguments }) => {
    if (type === 'options') {
      spam_color = arguments['spam_color'];
    } else if (type === "classify") {
      document
        .querySelectorAll(`a[href='${arguments["url"]}']`)
        .forEach((link) => {
          link.setAttribute('distilbert-spam', true);
          link.setAttribute('distilbert-original-color', link.style.backgroundColor);
          link.style.backgroundColor = `rgba(${spam_color[0]}, ${spam_color[1]}, ${spam_color[2]}, ${arguments["score"] - 0.3})`;
          link.setAttribute('distilbert-detected-color', link.style.backgroundColor);
        });
    }
  });
  
  const sanitize = (str) => {
    return str
      .replace(/\s+/g, " ")
      .trim();
  };

  const extract_text = (anchor) => {
    return anchor.innerText;
  };

  const basicBatchs = () => {
    return Array.from(
      document.querySelectorAll("a:not([distilbert-visited])")
    )
      .map((anchor) => {
        anchor.setAttribute("distilbert-visited", true);
        return anchor;
      })
      .filter((anchor) => sanitize(anchor.innerText).split(" ").length >= 3)
      .map((anchor) => ({
        url: anchor.getAttribute("href"),
        text: sanitize(extract_text(anchor)),
      }));
  };

  const classifyLinks = async () => {
    let batches = basicBatchs();

    if (batches === undefined || batches.length == 0) {
      return;
    }

    batches = batches.reduce((arr, one, i) => {
      const ch = Math.floor(i / 512);
      arr[ch] = [].concat(arr[ch] || [], one);
      return arr;
    }, []);

    for (const batch of batches) {
      backgroundPort.postMessage({ type: "classify", arguments: { batch: batch } });
    }
  }

  
  setInterval(classifyLinks, 2000);
  await classifyLinks();

})();
