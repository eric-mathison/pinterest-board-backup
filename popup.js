const boardEl = document.getElementById("board");
const backupButton = document.getElementById("backupBtn");
const warningMessage = document.getElementById("warning-message");

let progressBarTotalCount = 0;
let progressBarCurrentCount = 0;

chrome.tabs.query({ active: true }, (tabs) => {
  const tab = tabs[0];
  if (tab) {
    try {
      backupButton.addEventListener("click", () => {
        backupButton.disabled = true;
        backupButton.innerText = "Please Wait";
        warningMessage.innerText =
          "Do not navigate away until the backup is complete.";
        const options = Array.from(
          document.querySelectorAll('input[type="checkbox"]')
        )
          .filter((item) => item.checked)
          .map((item) => item.getAttribute("value"));
        sendOptionsMessage(options);
        chrome.tabs.sendMessage(tab.id, { type: "backup", target: "content" });
      });
    } catch (e) {
      alert("Something went wrong. Please refresh the page and try again");
    }
    execScript(tab);
  } else {
    alert("There are no active tabs");
  }
});

function execScript(tab) {
  chrome.scripting.executeScript(
    {
      target: { tabId: tab.id },
      func: getPageInfo,
    },
    onScriptResult
  );
}

/**
 * Gets DOM information from the active tab and makes the distinction if the current tab is a Pinterest Board page or not.
 *
 * @returns {title: string, scrollHeight: number, isBoard: boolean}
 */
function getPageInfo() {
  const container = document.querySelector(".mainContainer");
  const h1 = container.querySelectorAll("h1");
  const titleArray = [...h1];
  const title = titleArray.map((heading) => heading.innerText).join("_");
  const isBoard =
    !!document.querySelector('[data-test-id="user-profile-pin-grid"]') ||
    !!document.querySelector('[data-test-id="board-feed"]') ||
    !!document.querySelector('[data-test-id="base-board-pin-grid"]');
  const scrollHeight = window.scrollY;
  return { title, scrollHeight, isBoard };
}

/**
 * Receives DOM data from the active tab and updates the DOM of the popup window
 *
 * @param {[]} data
 * @returns
 */
function onScriptResult(data) {
  if (!data || !data.length || !data[0].result) {
    alert("Could not retrieve board info.");
    backupButton.disabled = true;
    return;
  }

  const { title, scrollHeight, isBoard } = data[0].result;
  const p = document.createElement("p");

  if (!isBoard) {
    backupButton.disabled = true;
    boardEl.classList.add("warning");
    boardEl.appendChild(p);
    p.innerText = "Browse to a board you want to backup";
    return;
  }

  if (scrollHeight > 0) {
    backupButton.innerText = "Refresh the page before backup";
    backupButton.disabled = true;
  }

  const boardOptions = boardEl
    .appendChild(document.createElement("div"))
    .appendChild(document.createElement("ol"));

  boardOptions.innerHTML = `
  <li>Browse to the board you want to backup</li>
  <span class="bold">Current Board: ${title}</span>
  <li>Select what you want to backup</li>
  <input type="checkbox" id="images" value="images" checked />
  <label class="bold" for="images">Images</label>
  <input type="checkbox" id="videos" value="videos" checked />
  <label class="bold" for="videos">Videos</label>
  <li>Click Back up now!</li>
  `;
}

/**
 * Send the selected options to background.js
 *
 * @param {[string]} options
 */
function sendOptionsMessage(options) {
  chrome.runtime.sendMessage({
    type: "options",
    target: "background",
    data: options,
  });
}

chrome.runtime.onMessage.addListener(handleMessages);

/**
 * Handles incoming messages sent over the messaging api
 *
 * @param {{type: string, target: string, data: *}} message
 */
function handleMessages(message) {
  if (message.target !== "popup") {
    return;
  }

  switch (message.type) {
    case "progressUpdate":
      const progress = document.getElementById("progress");
      if (progress && progress.style.display == "none") {
        progress.style.display = "block";
      }
      incrementProgressBar(message.data);
      break;
    default:
      console.warn(`Unexpected message type received: '${message.type}'.`);
  }
}

/**
 * Recieves current index and updates the progress bar
 *
 * @param {number} index
 */
function incrementProgressBar({ currentIndex, totalIndex }) {
  progressBarCurrentCount = Math.round((currentIndex / totalIndex) * 100);
  const progressBar = document.getElementById("progress-bar");
  progressBar.style.width = progressBarCurrentCount + "%";
  progressBar.innerHTML = progressBarCurrentCount + "%";
}

/**
 * Register onClick eventListener to open a new tab to buymeacoffee.com
 */
const coffeeButton = document
  .getElementById("coffeeBtn")
  .addEventListener("click", () => {
    chrome.tabs.create({
      url: "https://buymeacoffee.com/emathison",
      active: true,
    });
  });
