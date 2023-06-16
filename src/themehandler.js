var themeNow = ""

function applyColor(el, options) {
    if (options && !document.getElementById("extensionThemeOverride").checked) {
        try {
            if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
                el.style.setProperty('--background', options.dark.background.main)
                el.style.setProperty('--backgroundalt', options.dark.background.alt)
                el.style.setProperty('--button', options.dark.button.main)
                el.style.setProperty('--buttonhov', options.dark.button.hov)
                el.style.setProperty('--buttonact', options.dark.button.act)
                el.style.setProperty('--buttonacthov', options.dark.button.hovact)
            } else {
                el.style.setProperty('--background', options.light.background.main)
                el.style.setProperty('--backgroundalt', options.light.background.alt)
                el.style.setProperty('--button', options.light.button.main)
                el.style.setProperty('--buttonhov', options.light.button.hov)
                el.style.setProperty('--buttonact', options.light.button.act)
                el.style.setProperty('--buttonacthov', options.light.button.hovact)
            }
            return
        } catch (err) {
            loadColors()
        }
    } else {
        el.style.setProperty('--background', document.getElementById("backgroundmainchange").value)
        el.style.setProperty('--backgroundalt', document.getElementById("backgroundaltchange").value)
        el.style.setProperty('--color', document.getElementById("textmainchange").value)
        el.style.setProperty('--coloralt', document.getElementById("textaltchange").value)
        el.style.setProperty('--button', document.getElementById("buttonmainchange").value)
        el.style.setProperty('--buttonhov', document.getElementById("buttonhovchange").value)
        el.style.setProperty('--buttonact', document.getElementById("buttonactchange").value)
        el.style.setProperty('--buttonacthov', document.getElementById("buttonhovactchange").value)
    }
}

function loadColors(options) {
    if (document.getElementById("element").value) {
        const elements = document.querySelectorAll(document.getElementById("element").value)
        for (const element of elements) {
            applyColor(element, options)
        }
    } else {
        applyColor(document.documentElement, options)
    }
    document.documentElement.style.setProperty('--darkness', String(Number(document.getElementById("darknessControl").value) / 1000))
}

function clearColor() {
    themeNow = ""
    document.getElementById("element").value = ""
    document.getElementById("backgroundmainchange").value = ""
    document.getElementById("backgroundaltchange").value = ""
    document.getElementById("textmainchange").value = ""
    document.getElementById("textaltchange").value = ""
    document.getElementById("buttonmainchange").value = ""
    document.getElementById("buttonhovchange").value = ""
    document.getElementById("buttonactchange").value = ""
    document.getElementById("buttonhovactchange").value = ""
    loadColors()

    for (const thing of document.querySelectorAll("*")) {
        thing.style.setProperty('--background', "")
        thing.style.setProperty('--backgroundalt', "")
        thing.style.setProperty('--color', "")
        thing.style.setProperty('--coloralt', "")
        thing.style.setProperty('--button', "")
        thing.style.setProperty('--buttonhov', "")
        thing.style.setProperty('--buttonact', "")
        thing.style.setProperty('--buttonacthov', "")
    }
}

window.loadColors = loadColors
const crinsom = Math.floor(Math.random() * 100)
if (crinsom === 73) {
    document.getElementById("texttitle").innerHTML = "CrinsomGUI"
}

function changeWinText() {
    setTimeout(() => {
        document.title = document.getElementById("texttitle").innerHTML
    }, 200)
}

function addTheme(name) {
    const script = document.createElement("script")
    script.setAttribute("src", "./themes/"+name)
    script.onload = () => {
        themeNow = name
    }
    document.head.appendChild(script)
}

window.onload = () => {
    if (crimAPI.guicfg().theme) {
        addTheme(crimAPI.guicfg().theme)
    }
    if (crimAPI.guicfg().darkness) {
        document.documentElement.style.setProperty('--darkness', String(Number(crimAPI.guicfg().darkness) / 1000))
    }
    if (crimAPI.guicfg().override) {
        document.getElementById("extensionThemeOverride").checked = true
    }

    for (const theme of crimAPI.themes()) {
        const button = document.createElement("button")
        button.classList.add("button")
        button.setAttribute("onclick", `addTheme("${theme}")`)
        button.innerHTML = theme.slice(0, -3)
        document.getElementById("themesBTNHolder").insertAdjacentHTML("beforeend", button.outerHTML)
    }
}

function saveGUISettings() {
    const options = {
        theme: themeNow,
        darkness: document.getElementById("darknessControl").value,
        override: document.getElementById("extensionThemeOverride").checked
    }
    handleNotification("savingModal", 3000)
    crimAPI.jsonRequest(["setJSONNotStyle", "guicfg.json", JSON.stringify(options)])
}