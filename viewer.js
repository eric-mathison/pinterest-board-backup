document.addEventListener("DOMContentLoaded", () => {
  const masonryContainer = document.getElementById("masonry");
  data.forEach((item) => {
    const card = document.createElement("div");
    card.className = "card";

    let mediaContent = "";
    if (item.videoUrl) {
      mediaContent = `<video src="${item.videoUrl}" controls></video>`;
    } else if (item.imageUrl) {
      mediaContent = `<img src="${item.imageUrl}" alt="${
        item.title || "Image"
      }">`;
    }

    card.innerHTML = `
                  ${mediaContent}
                  <div class="card-content">
                      <h2>${item.title || "Untitled"}</h2>
                      <p>${item.description || ""}</p>
                      ${
                        item.note
                          ? `<p><strong>Note:</strong> ${item.note}</p>`
                          : ""
                      }
                      ${
                        item.sourceUrl
                          ? `<p><a href="${item.sourceUrl}" target="_blank">Source</a></p>`
                          : ""
                      }
                  </div>
              `;

    masonryContainer.appendChild(card);
  });
});
