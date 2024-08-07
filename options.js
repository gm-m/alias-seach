let searchEngines = {};

function loadSavedData() {
    chrome.storage.sync.get("searchEnginesObj", (result) => {
        searchEngines = result.searchEnginesObj ?? { targetWindow: '_blank', openAsUrl: true, incognitoMode: false, enableMultiAlias: false };
        displayData(searchEngines);
    });
}

function saveSettings() {
    if (!searchEngines) searchEngines = {};
    searchEngines.targetWindow = document.getElementById('tab-settings-target-windows').checked ? '_blank' : '_self';
    searchEngines.openAsUrl = document.getElementById('tab-settings-open-as-url').checked;
    searchEngines.incognitoMode = document.getElementById('tab-settings-open-incognito-mode').checked;
    searchEngines.enableMultiAlias = document.getElementById('tab-settings-enable-multi-alias').checked;

    chrome.storage.sync.set({ "searchEnginesObj": searchEngines });
}

function addAliasToDom(searchEnginesObj) {
    const { name, searchEngine, url, hasPlaceholder } = searchEnginesObj;
    const aliasDiv = document.createElement('div');
    aliasDiv.id = name;
    aliasDiv.className = "active-alias d-flex flex-column col-4 gap-2 mb-5";
    aliasDiv.innerHTML = `
    <input autocomplete="off" class="extended-name form-control" name="${searchEngine}" value="${searchEngine}" readonly>
    <input autocomplete="off" class="name form-control" name="${name}" value="${name}" readonly>
    <input id="alias-url" autocomplete="off" class="value form-control" name="${url}" value="${url}">
    <div class="form-check form-switch form-switch-xl">
        <input id="alias-placeholder" class="form-check-input" type="checkbox" disabled>
        <label class="form-check-label" for="alias-placeholder">Placeholder</label>
    </div>

    <div class="d-flex gap-5">
        <button id="update-${name}" class="btn btn-secondary w-50 ${name}">Update</button>
        <button id="${name}" class="btn btn-danger w-50">Delete</button>
    </div>
    `;

    aliasDiv.querySelectorAll('button')[0].addEventListener("click", updateAlias, false);
    aliasDiv.querySelectorAll('button')[1].addEventListener("click", deleteAlias, false);
    aliasDiv.querySelector('#alias-placeholder').checked = hasPlaceholder;

    const divContainer = document.getElementById('display-content');
    divContainer.appendChild(aliasDiv);
}

function updateAlias(event) {
    const targetClassName = event.target.className;
    const targetInput = document.querySelectorAll(`#display-content #${targetClassName} input`);
    const [aliasInput, urlInput] = targetInput;

    if (!urlInput.value.includes("%s")) displayCustomError("Url must includes %s");
    searchEngines[targetClassName] = { searchEngine: aliasInput.value, url: urlInput.value };
    chrome.storage.sync.set({ "searchEnginesObj": searchEngines }, () => { });
}

function deleteAlias(event) {
    const targetId = event.target.id;

    searchEngines.alias = Object.fromEntries(Object.entries(searchEngines.alias).filter(([key]) => key !== targetId));
    chrome.storage.sync.set({ "searchEnginesObj": searchEngines }, () => {
        document.getElementById(targetId).remove();
        showData(hasAliases(searchEngines));
    });
}

function displayData(content) {
    document.getElementById('tab-settings-target-windows').checked = searchEngines.targetWindow === '_blank';
    document.getElementById('tab-settings-open-as-url').checked = searchEngines.openAsUrl;
    document.getElementById('tab-settings-open-incognito-mode').checked = searchEngines.incognitoMode;
    document.getElementById('tab-settings-enable-multi-alias').checked = searchEngines.enableMultiAlias;

    if (hasAliases(content)) {
        for (const key in searchEngines.alias) {
            addAliasToDom({
                name: key,
                searchEngine: searchEngines.alias[key].searchEngine,
                url: searchEngines.alias[key].url,
                hasPlaceholder: searchEngines.alias[key].hasPlaceholder
            });
        }
        showData(true);
    } else {
        showData(false);
    }
}

function showData(flag) {
    if (!flag) document.getElementById('display-content').innerHTML = '';
    document.getElementById('display-empty').style.display = flag ? 'none' : 'block';
    document.getElementById('btn-reset').style.display = flag ? 'block' : 'none';
}

function createNewAlias() {
    const aliasUrlDomEl = document.getElementById('url');
    const newAlias = {
        searchEngine: document.getElementById('search-engine').value,
        name: document.getElementById('alias').value,
        url: aliasUrlDomEl.value,
        hasPlaceholder: aliasUrlDomEl.value && aliasUrlDomEl.value.includes("%s")
    };

    if (!newAlias.name || !newAlias.url) displayCustomError("Fill all data");
    if (!hasAliases(searchEngines)) searchEngines = { alias: {} };
    if (searchEngines.hasOwnProperty(newAlias.name)) displayCustomError("An alias with same name already exists");

    searchEngines.alias[newAlias.name] = {
        searchEngine: newAlias.searchEngine,
        url: newAlias.url,
        hasPlaceholder: newAlias.hasPlaceholder
    };

    chrome.storage.sync.set({ "searchEnginesObj": searchEngines }, () => {
        addAliasToDom(newAlias);
        showData(true);
    });
}

function clearData() {
    if (confirm("Do you really want to delete all aliases?") === true) {
        chrome.storage.sync.clear();
        searchEngines = {};

        showData(false);
    }
}

function displayCustomError(msg) {
    alert(msg);
    throw new Error(msg);
}

function hasAliases(obj) {
    return obj?.alias && Object.keys(obj.alias).length;
}

// EVENT LISTENERS

document.getElementById("btn-add-new-alias").addEventListener("click", createNewAlias);
document.getElementById("btn-save-settings").addEventListener("click", saveSettings);

document.getElementById("btn-reset").addEventListener("click", clearData);
document.getElementById("btn-import-json").onchange = ({ target }) => {
    const file = target.files[0];

    if (file) {
        new Response(file).json().then((fileContent) => {
            const mergedAliases = { ...searchEngines.alias, ...fileContent.alias };
            searchEngines = fileContent;
            searchEngines.alias = mergedAliases;

            chrome.storage.sync.set({ "searchEnginesObj": searchEngines }, () => {
                loadSavedData();
            });
        });
    }
}
document.getElementById("btn-export-json").addEventListener("click", () => {
    if (hasAliases(searchEngines)) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([JSON.stringify(searchEngines)], { type: 'application/json' }));
        a.download = 'aliases.json';
        a.click();
    } else {
        alert("No data to export");
    }
});

document.addEventListener('DOMContentLoaded', loadSavedData);
