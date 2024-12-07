chrome.runtime.onMessage.addListener(handleMessages);

/**
 * Handles incoming messages sent over the messaging api
 *
 * @param {{type: string, target: string, data: *}} message
 */
async function handleMessages(message) {
  if (message.target !== "content") {
    return;
  }

  switch (message.type) {
    case "backup":
      await getPins();
      break;
    case "processJsonArray":
      const { title, jsonArray } = message.data;
      const archive = await processJsonArray(jsonArray);
      downloadArchive(archive, title);
      break;
    default:
      console.warn(`Unexpected message type received: '${message.type}'.`);
  }
}

/**
 * Inspects the DOM of the active tab and gathers data from each pin
 * Adds pin data to an Array which is sent to background.js for processing
 */
async function getPins() {
  try {
    const container = document.querySelector(".mainContainer");
    const h1 = container.querySelector("h1");
    const title = h1.innerText;
    const targetNode =
      document.querySelector('[data-test-id="user-profile-pin-grid"]') ||
      document.querySelector('[data-test-id="board-feed"]') ||
      document.querySelector('[data-test-id="base-board-pin-grid"]');
    const config = {
      attributes: true,
      childList: true,
      subtree: true,
    };

    let pinIds = [];
    const initialPins = targetNode.querySelectorAll('[data-test-id="pin"]');
    const pinArray = Array.from(initialPins).map((pin) => {
      const id = pin.getAttribute("data-test-pin-id");
      const isVideo = !!pin.querySelector('[data-test-id="pinrep-video"]');
      return { id, isVideo };
    });

    pinIds = [...pinArray];

    const callback = (mutationList, observer) => {
      for (const mutation of mutationList) {
        if (mutation.type === "childList" && mutation.addedNodes) {
          try {
            const addedNode = mutation.addedNodes[0];
            if (addedNode) {
              const nestedChild = addedNode.querySelector(
                '[data-test-id="pin"]'
              );
              if (nestedChild) {
                pinIds.push({
                  id: nestedChild.getAttribute("data-test-pin-id"),
                  isVideo: !!nestedChild.querySelector(
                    '[data-test-id="pinrep-video"]'
                  ),
                });
              }
            }
          } catch (e) {
            console.log(e);
          }
        }
      }
    };

    const observer = new MutationObserver(callback);
    observer.observe(targetNode, config);

    const autoScroll = () =>
      new Promise((resolve) => {
        let lastScrollHeight = 0;
        const scroll = setInterval(() => {
          const sh = document.documentElement.scrollHeight;
          if (sh != lastScrollHeight) {
            lastScrollHeight = sh;
            scrollTo({ top: sh, behavior: "smooth" });
          } else {
            clearInterval(scroll);
            observer.disconnect();
            resolve();
          }
        }, 2500);
      });

    await autoScroll();

    const uniquePinObjects = new Set(pinIds.map(JSON.stringify));
    const uniquePinArray = Array.from(uniquePinObjects).map(JSON.parse);

    chrome.runtime.sendMessage({
      type: "get-page-data",
      target: "background",
      data: { title, uniquePinArray },
    });
  } catch (e) {
    alert("Something went wrong. Please refresh the page and try again");
  }
}

/**
 * Creates a new archive blob and loops through the generated array of
 * pins, downloads the media and add the blob output to the zip for
 * download
 *
 * @param {*} jsonArray
 */
async function processJsonArray(jsonArray) {
  const zip = new JSZip();
  // loop thorugh jsonArray
  let updatedJsonArray = [];
  for (const [index, pin] of jsonArray.entries()) {
    try {
      const url = pin.videoUrl || pin.imageUrl || null;
      if (url) {
        const media = await fetch(url);
        const blob = await media.blob();
        const { file, type } = checkAndGetFileName(index, blob);
        zip.folder("media").file(file, blob);
        updatedJsonArray.push({
          ...pin,
          imageUrl: type === "image" ? `media/${file}` : "",
          videoUrl: type === "video" ? `media/${file}` : "",
        });
      }

      chrome.runtime.sendMessage({
        type: "progressUpdate",
        target: "popup",
        data: { currentIndex: index + 1, totalIndex: jsonArray.length },
      });
    } catch (error) {
      console.error(error);
    }
  }

  zip.file("data.js", `const data = ${JSON.stringify(updatedJsonArray)}`);

  const viewerHtmlURL = chrome.runtime.getURL("viewer.html");
  const viewerJsURL = chrome.runtime.getURL("viewer.js");

  const viewerHtmlBlob = await fetch(viewerHtmlURL).then((resp) => resp.blob());
  const viewerJsBlob = await fetch(viewerJsURL).then((resp) => resp.blob());

  zip.file("viewer.html", viewerHtmlBlob);
  zip.file("viewer.js", viewerJsBlob);

  return await zip.generateAsync({ type: "blob" });
}

/**
 * Checks the blob type and size and returns a name and the extension
 *
 * @param {number} index
 * @param {*} blob
 * @returns
 */
function checkAndGetFileName(index, blob) {
  let name = parseInt(index) + 1;
  const [type, extension] = blob.type.split("/");
  if ((type !== "image" && type !== "video") || blob.size <= 0) {
    throw Error(`Incorrect content: ${type} | size: ${blob.size}`);
  }
  return { file: `${name}.${extension}`, type };
}

/**
 * Creates an a href at the bottom of the current document and clicks
 * the link to forcably download the archive
 *
 * @param {*} archive
 * @param {string} title
 */
function downloadArchive(archive, title) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(archive);
  link.download = `${title}.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
