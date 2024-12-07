chrome.runtime.onMessage.addListener(handleMessages);

/**
 * Handles incoming messages sent over the messaging api
 *
 * @param {{type: string, target: string, data: *}} message
 */
async function handleMessages(message) {
  if (message.target !== "offscreen") {
    return false;
  }

  switch (message.type) {
    case "parse-page":
      parsePage(message.data);
      break;
    default:
      console.warn(`Unexpected message type received: '${message.type}'.`);
      return false;
  }

  /**
   * Parses a htmlstring and sends the parsed data to background.js
   *
   * @param {{pinId: string, htmlString: string}}
   */
  async function parsePage({ pinId, htmlString }) {
    try {
      const parser = new DOMParser();
      const document = parser.parseFromString(htmlString, "text/html");
      const data = {
        id: pinId,
        props: JSON.parse(
          document.getElementById("__PWS_INITIAL_PROPS__")?.innerText
        )?.initialReduxState?.pins[pinId],
      };
      sendtoBackground("page-data-result", data);
    } catch (e) {
      throw Error(e);
    }
  }

  function sendtoBackground(type, data) {
    chrome.runtime.sendMessage({
      type,
      target: "background",
      data,
    });
  }
}
