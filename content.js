let searchEngines = {};

function openPopup() {
  chrome.storage.sync.get("searchEnginesObj", (result) => {
    searchEngines = result.searchEnginesObj ?? { targetWindow: '_blank', openAsUrl: true, incognitoMode: false, enableMultiAlias: false };
  });

  const popupContainer = document.createElement('div');
  popupContainer.attachShadow({ mode: 'open' });
  popupContainer.style = "position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 35%; z-index: 999999;"
  if (popupContainer.shadowRoot) {
    popupContainer.shadowRoot.innerHTML = `
    <style>
      :host {all: initial;}

      .p-0 {
          padding: 0;
      }

      span,
      input {
          font-family: sans-serif;
          font-size: medium;
          color: #d1d0c5;
          background-color: #323437;
          border: none;
          border-radius: .5rem;
          outline: none;
      }

      div {
          background-color: #323437;
          padding: 12px;
      }
    </style>`
  }

  const popup = document.createElement('div');
  popup.style = 'border-radius: .5rem;'
  popup.innerHTML = `
        <div id="modal">
          <span class="searchicon">
            &#x1F50E;&#xFE0E;
          </span>

          <input type="text" id="user-input" placeholder="Search..."  autocomplete="off">
        </div>

        <hr>

        <div class="p-0">
          <span id="active-alias">No match found</span>
        </div>
  `;

  popupContainer.shadowRoot.appendChild(popup);
  document.body.appendChild(popupContainer);

  const userInputElement = popup.querySelector('#user-input');
  userInputElement.focus();

  userInputElement.addEventListener('input', function (event) {
    event.stopPropagation();

    const inputText = event.target.value;
    popup.querySelector('#active-alias').innerText = getAliasPreview(inputText);
  });

  function getAliasPreview(inputText) {
    if (searchEngines.enableMultiAlias) {
      const aliasSet = new Set();
      let aliasDescriptionArray = [];

      for (const element of inputText.split(' ')) {
        if (searchEngines.alias.hasOwnProperty(element)) {
          if (!aliasSet.has(element)) {
            aliasSet.add(element);
            aliasDescriptionArray.push(searchEngines.alias[element].searchEngine);
          }
        } else {
          break; // Stop after the first non alias found. We can assume the rest of the string is the search query
        }
      }

      return aliasDescriptionArray.length ? `${aliasDescriptionArray.join(' - ')} | Target: ${searchEngines.targetWindow}` : 'No match found';
    } else {
      const aliasName = inputText.split(' ')[0];
      return aliasName && searchEngines.alias && searchEngines.alias.hasOwnProperty(aliasName) ? `${searchEngines.alias[aliasName].searchEngine} | Target: ${searchEngines.targetWindow}` : 'No match found';
    }
  }

  userInputElement.addEventListener('keydown', function (event) {
    event.stopPropagation();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === 'Escape') popupContainer.remove();
  }, { capture: true });

  popup.querySelector("#modal").addEventListener('keypress', function (e) {
    e.stopPropagation();
    if (e.key === 'Enter') {
      const userInput = popup.querySelector('#user-input').value;
      const [aliasName, ...searchQueryParts] = userInput.split(' ');
      const aliasFound = searchEngines.alias?.hasOwnProperty(aliasName);
      const searchQuery = searchQueryParts.join(' ').trim();
      if (!aliasName) return;

      if (!aliasFound && searchEngines.openAsUrl) {
        const targetUrl = !searchQuery.match(/^https?:\/\//i) ? 'https://' + userInput : userInput;
        chrome.runtime.sendMessage({ action: "openTab", url: targetUrl, targetWindow: searchEngines.targetWindow, incognitoMode: searchEngines.incognitoMode });
      } else if (aliasFound) {
        const alias = searchEngines.alias[aliasName];
        if (alias.hasPlaceholder && !searchQuery) return;

        const targetUrl = alias.hasPlaceholder ? alias.url.replace('%s', searchQuery) : alias.url;
        chrome.runtime.sendMessage({ action: "openTab", url: targetUrl, targetWindow: searchEngines.targetWindow, incognitoMode: searchEngines.incognitoMode });
      }

      popupContainer.remove();
    }
  });
}