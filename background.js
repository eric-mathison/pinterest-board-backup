const OFFSCREEN_DOCUMENT_PATH = "/offscreen.html";
let title;
let json;
let jsonArray = [];
let options = [];

chrome.runtime.onMessage.addListener(handleMessages);

/**
 * Handles incoming messages sent over the messaging api
 *
 * @param {{type: string, target: string, data: *}} message
 */
async function handleMessages(message) {
  if (message.target !== "background") {
    return;
  }

  switch (message.type) {
    case "options":
      options = message.data;
      break;
    case "get-page-data":
      ({ title, uniquePinArray } = message.data);
      for (const pin of uniquePinArray) {
        chrome.runtime.sendMessage({
          type: "progressUpdate",
          target: "popup",
          data: { currentIndex: 0, totalIndex: 1 },
        });
        if (shouldGetPageData(options, pin)) {
          await getPageInfo("parse-page", pin.id);
          chrome.runtime.sendMessage({
            type: "progressUpdate",
            target: "popup",
            data: { currentIndex: 1, totalIndex: 1 },
          });
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 3000));
      closeOffscreenDocument();

      chrome.tabs.query({ active: true }, (tabs) => {
        const tab = tabs[0];
        if (tab) {
          chrome.tabs.sendMessage(tab.id, {
            type: "processJsonArray",
            target: "content",
            data: { title, jsonArray },
          });
        }
      });

      await new Promise((resolve) => setTimeout(resolve, 3000));
      jsonArray = [];
      break;
    case "page-data-result":
      handlePageDataResult(message.data);
      break;
    default:
      console.warn(`Unexpected message type received: '${message.type}'.`);
  }
}

/**
 * Conditionally creates an offscreen document and fetches a pin.
 * Sends a message to offscreen.js with the html text for parsing
 *
 * @param {string} type
 * @param {string} pinId
 */
async function getPageInfo(type, pinId) {
  if (!(await hasDocument())) {
    await chrome.offscreen.createDocument({
      url: OFFSCREEN_DOCUMENT_PATH,
      reasons: [chrome.offscreen.Reason.DOM_PARSER],
      justification: "Parse DOM",
    });
  }

  const url = `https://www.pinterest.com/pin/${pinId}/`;
  const htmlString = await fetchWithRandomDelay(url).then((data) => data);

  chrome.runtime.sendMessage({
    type,
    target: "offscreen",
    data: { pinId, htmlString },
  });
}

/**
 * Takes parsed data from offscreen.js and pushes data to jsonArray
 *
 * @param {*} data
 */
function handlePageDataResult(data) {
  const pinId = data.id;
  const pinData = {
    id: pinId,
    title: data.props.closeup_unified_title || undefined,
    description: data.props.closeup_unified_description || undefined,
    sourceUrl: data.props.link || undefined,
    pinUrl: `https://www.pinterest.com/pin/${data.id}/`,
    imageUrl: data.props.images?.orig?.url,
    videoUrl:
      data.props.videos?.video_list?.V_720P?.url ||
      data.props.story_pin_data?.pages[0]?.blocks[0]?.video?.video_list?.V_EXP4
        ?.url,
    note: data.props.pin_note?.text,
  };
  jsonArray.push(pinData);
}

/**
 * Determines if the pin should be scraped based off if the pin is an image or video
 *
 * @param {[]} options
 * @param {*} pin
 * @returns boolean
 */
function shouldGetPageData(options, pin) {
  if (
    (!options.includes("videos") && pin.isVideo) ||
    (!options.includes("images") && !pin.isVideo)
  ) {
    return false;
  }
  return true;
}

/**
 * Close any offscreen documents
 *
 * @returns
 */
async function closeOffscreenDocument() {
  if (!(await hasDocument())) {
    return;
  }
  await chrome.offscreen.closeDocument();
}

/**
 * Determines if an Offscreen document exists
 *
 * @returns boolean
 */
async function hasDocument() {
  const matchedClients = await clients.matchAll();
  for (const client of matchedClients) {
    if (client.url.endsWith(OFFSCREEN_DOCUMENT_PATH)) {
      return true;
    }
  }
  return false;
}

/**
 * Returns a random time in milliseconds between the supplied minTime and maxTime
 *
 * @param {number} minTime
 * @param {number} maxTime
 * @returns Random time in milliseconds
 */
function getRandomFetchTime(minTime, maxTime) {
  return Math.floor(Math.random() * (maxTime - minTime + 1)) + minTime;
}

/**
 * Fetch with a random delay
 *
 * @param {string} url
 * @returns
 */
async function fetchWithRandomDelay(url) {
  const delay = getRandomFetchTime(200, 1000);
  await new Promise((resolve) => setTimeout(resolve, delay));

  try {
    const response = await fetch(url).then((data) => data.text());
    return response;
  } catch (error) {
    console.error("Error fetching data", error);
  }
}
