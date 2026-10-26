/*
  Mapping the Headlines: page behavior
  Reads the stories array from data.js and builds
  the story list and map markers.
*/

const storyList = document.querySelector("#story-list");
const storyCount = document.querySelector("#story-count");
const searchInput = document.querySelector("#story-search");
const topicFilter = document.querySelector("#topic-filter");
const resetButton = document.querySelector("#reset-filters");
const markerLayer = document.querySelector("#map-markers");
const mapEmpty = document.querySelector("#map-empty");
const mapStatus = document.querySelector("#map-status");

function formatDate(dateString) {
  if (!dateString) return "Date not listed";

  const date = new Date(`${dateString}T12:00:00`);

  if (Number.isNaN(date.getTime())) return dateString;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

function safeStories() {
  return Array.isArray(stories) ? stories : [];
}

function getTopics() {
  return [
    ...new Set(
      safeStories()
        .map(story => story.topic)
        .filter(Boolean)
    )
  ].sort((a, b) => a.localeCompare(b));
}

function buildTopicFilter() {
  getTopics().forEach(topic => {
    const option = document.createElement("option");

    option.value = topic;
    option.textContent = topic;

    topicFilter.appendChild(option);
  });
}

function getFilteredStories() {
  const searchTerm = searchInput.value.trim().toLowerCase();
  const selectedTopic = topicFilter.value;

  return safeStories().filter(story => {
    const searchableText = [
      story.title,
      story.location,
      story.country,
      story.topic,
      story.summary,
      story.sourceName
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const matchesSearch = searchableText.includes(searchTerm);

    const matchesTopic =
      selectedTopic === "all" ||
      story.topic === selectedTopic;

    return matchesSearch && matchesTopic;
  });
}

function renderStories() {
  const filteredStories = getFilteredStories();

  storyList.replaceChildren();

  storyCount.textContent =
    `${filteredStories.length} ${
      filteredStories.length === 1 ? "story" : "stories"
    }`;

  if (filteredStories.length === 0) {
    const emptyBox = document.createElement("div");

    emptyBox.className =
      safeStories().length === 0
        ? "empty-stories"
        : "no-results";

    if (safeStories().length === 0) {
      emptyBox.innerHTML = `
        <p class="empty-stories-kicker">THE DESK IS OPEN</p>
        <h3>No stories filed yet.</h3>
        <p>This is intentional. Add a story only after checking
        the original reporting, date, location, and source link.</p>
      `;
    } else {
      emptyBox.textContent =
        "No stories match those filters. Try a different search or clear the filters.";
    }

    storyList.appendChild(emptyBox);
    return;
  }

  filteredStories
    .slice()
    .sort((a, b) =>
      String(b.date).localeCompare(String(a.date))
    )
    .forEach(story => {
      const card = document.createElement("article");
      card.className = "story-card";

      const meta = document.createElement("div");
      meta.className = "story-meta";

      const topic = document.createElement("span");
      topic.className = "story-topic";
      topic.textContent = story.topic || "News";

      const date = document.createElement("span");
      date.textContent = formatDate(story.date);

      meta.append(topic, date);

      const title = document.createElement("h3");
      title.textContent = story.title || "Untitled story";

      const location = document.createElement("p");
      location.className = "story-location";
      location.textContent = [
        story.location,
        story.country
      ].filter(Boolean).join(", ");

      const summary = document.createElement("p");
      summary.className = "story-summary";
      summary.textContent =
        story.summary || "No summary has been added.";

      const footer = document.createElement("div");
      footer.className = "story-card-footer";

      const sources = Array.isArray(story.sources)
        ? story.sources
        : [];

      if (sources.length > 0) {
        sources.forEach(item => {
          const source = document.createElement("span");
          source.className = "story-source";
          source.textContent = `Source: ${item.name || "News outlet"}`;

          footer.appendChild(source);

          if (isSafeHttpUrl(item.url)) {
            const link = document.createElement("a");

            link.className = "story-link";
            link.href = item.url;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.textContent = `Read ${item.name || "source"} ↗`;

            footer.appendChild(link);
          }
        });
      } else {
        const source = document.createElement("span");
        source.className = "story-source";
        source.textContent = story.sourceName
          ? `Source: ${story.sourceName}`
          : "Source not listed";

        footer.appendChild(source);

        if (isSafeHttpUrl(story.sourceUrl)) {
          const link = document.createElement("a");

          link.className = "story-link";
          link.href = story.sourceUrl;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          link.textContent = "Read Source ↗";

          footer.appendChild(link);
        }
      }

      

      if (story.impact) {
        const impact = document.createElement("div");
        impact.className = "story-impact";

        const heading = document.createElement("h4");
        heading.textContent = "Impact";

        const text = document.createElement("p");
        text.textContent = story.impact;

        impact.append(heading, text);
        card.append(meta, title, location, summary, impact, footer);
      } else {
        card.append(meta, title, location, summary, footer);
      }
      storyList.appendChild(card);
    });
}

function isSafeHttpUrl(value) {
  try {
    const url = new URL(value);

    return (
      url.protocol === "https:" ||
      url.protocol === "http:"
    );
  } catch {
    return false;
  }
}

/*
  Position story markers on the new world.svg map.
  The map uses an equirectangular layout.
*/

function projectCoordinates(latitude, longitude) {
  const x =
    10 + ((Number(longitude) + 180) / 360) * 880;

  const y =
    ((90 - Number(latitude)) / 180) * 440;

  return { x, y };
}

function renderMapMarkers() {
  markerLayer.replaceChildren();

  const validStories = safeStories().filter(story => {
    const latitude = Number(story.latitude);
    const longitude = Number(story.longitude);

    return (
      story.latitude !== "" &&
      story.longitude !== "" &&
      story.latitude != null &&
      story.longitude != null &&
      Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      latitude >= -90 &&
      latitude <= 90 &&
      longitude >= -180 &&
      longitude <= 180
    );
  });

  mapEmpty.hidden = validStories.length > 0;

  mapStatus.textContent =
    validStories.length === 0
      ? "No stories plotted yet"
      : `${validStories.length} ${
          validStories.length === 1 ? "story" : "stories"
        } plotted`;

  validStories.forEach(story => {
    const point = projectCoordinates(
      story.latitude,
      story.longitude
    );

    const marker = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "g"
    );

    marker.setAttribute("class", "map-marker");
    marker.setAttribute("tabindex", "0");
    marker.setAttribute("role", "button");
    marker.setAttribute(
      "aria-label",
      `Read story: ${story.title || "Untitled story"}`
    );
    marker.setAttribute(
      "transform",
      `translate(${point.x} ${point.y})`
    );

    const circle = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "circle"
    );

    circle.setAttribute("r", "7");

    const label = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "text"
    );

    label.setAttribute("x", "11");
    label.setAttribute("y", "-10");
    label.textContent =
      story.location ||
      story.country ||
      story.title ||
      "Story";

    marker.append(circle, label);

    const openStory = () => {
      const matchingCard = [
        ...document.querySelectorAll(".story-card h3")
      ].find(heading =>
        heading.textContent === story.title
      );

      if (matchingCard) {
        matchingCard.closest(".story-card").scrollIntoView({
          behavior: "smooth",
          block: "center"
        });
      } else {
        searchInput.value =
          story.location || story.country || "";

        topicFilter.value = "all";

        renderStories();

        document.querySelector("#stories-title").scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      }
    };

    marker.addEventListener("click", openStory);

    marker.addEventListener("keydown", event => {
      if (
        event.key === "Enter" ||
        event.key === " "
      ) {
        event.preventDefault();
        openStory();
      }
    });

    markerLayer.appendChild(marker);
  });
}

function clearFilters() {
  searchInput.value = "";
  topicFilter.value = "all";

  renderStories();
}

searchInput.addEventListener("input", renderStories);
topicFilter.addEventListener("change", renderStories);
resetButton.addEventListener("click", clearFilters);

buildTopicFilter();
renderStories();
renderMapMarkers();

async function loadLiveHeadlines() {
  const feed = document.getElementById("headlines-feed");

  if (!feed) return;

  feed.replaceChildren();

  const loading = document.createElement("p");
  loading.className = "feed-note";
  loading.textContent = "Loading recent headlines…";
  feed.appendChild(loading);

  try {
    const rssUrl = "https://www.timesofisrael.com/feed/";
    const apiUrl =
      "https://api.rss2json.com/v1/api.json?rss_url=" +
      encodeURIComponent(rssUrl);

    const response = await fetch(apiUrl);

    if (!response.ok) {
      throw new Error("The feed service returned an error.");
    }

    const data = await response.json();

    if (data.status !== "ok" || !Array.isArray(data.items)) {
      throw new Error("The news feed could not be read.");
    }

    feed.replaceChildren();

    data.items.slice(0, 8).forEach(item => {
      if (!item.title || !isSafeHttpUrl(item.link)) return;

      const article = document.createElement("article");
      article.className = "headline-item";

      const title = document.createElement("h3");
      const link = document.createElement("a");
      link.href = item.link;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = item.title;
      title.appendChild(link);

      const source = document.createElement("p");
      source.className = "headline-source";
      source.textContent = "The Times of Israel";

      article.append(title, source);
      feed.appendChild(article);
    });

    if (!feed.children.length) {
      feed.textContent = "No headlines are available right now.";
    }
  } catch (error) {
    feed.replaceChildren();

    const message = document.createElement("p");
    message.className = "feed-note";
    message.textContent =
      "Headlines are temporarily unavailable. Please try again later.";

    feed.appendChild(message);
    console.error("Live headlines error:", error);
  }
}

loadLiveHeadlines();
