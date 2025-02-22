//*
//* Imports
//*

//? ESM imports
import { createRequire } from "module"
import fetch from "node-fetch"
import { fileURLToPath } from "url"

//? CJS imports
const require = createRequire(import.meta.url)
const console = require("./consolelogger")
const fs = require("fs")
const path = require("path")
const {
    Client,
    Collection,
    Events,
    GatewayIntentBits,
    ActivityType,
} = require("discord.js")
const net = require('net')
const config = require("../config.json")
const command = require("./deploy-commands")
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const clients = {}
const vm = require("vm")

//*
//* Global vars/consts
//*

//? Tag command list for ez tag commands
const tagsList = []

//*
//* Bot set-up
//*

//? New client for Discord.JS and main storage
global.client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates
    ],
})

//? When client is ready do some logging and cleaning and setup users
client.once(Events.ClientReady, async (c) => {
    client.user.setActivity(`over the server`, { type: ActivityType.Watching })
    client.user.setStatus("online")
    console.start(`The bot is now online! Running bot as ${c.user.tag}`)
    command.deploy(client.guilds.cache)
})

//? Login to client and define some commands
client.login(config.token)
client.commands = new Collection()

//*
//* Extensions
//*

const server = net.createServer((socket) => {
    socket.on('data', (data) => {
        data = data.toString("utf-8")
        const msgs = data.split("ܛ")
        for (data of msgs) {
            data = data.replaceAll("\\u071B", "ܛ")
            if (data.startsWith("SYSMSG")) {
                if (data.startsWith("SYSMSG ID=")) {
                    clients[data.slice(10)] = socket
                }
            } else if (data === undefined) { } else {
                try {
                    var msg = JSON.parse(data)
                    if (msg.type === "addTag") {
                        tagsList.push({
                            tag: msg.info.tag,
                            function: eval(`(${msg.info.function})`)
                        })
                    } else if (msg.type === "sendDataTo") {
                        try {
                            var msgdata = JSON.stringify(msg.info.message)
                        } catch (err) {
                            var msgdata = msg.info.message
                        } finally {
                            clients[msg.info.extension].write("EXMSG " + msgdata)
                        }
                    }
                } catch (err) {
                    if (data !== "") {
                        console.warn("Data was found that was invalid")
                    }
                }
            }
        }
    })
})

server.on('error', (err) => {
    console.error(`IPC Error for Extensions: ${err}`)
    console.error(`Extensions cannot communicate, please consider closing all instances of Crimson and trying again`)
    console.hint("If the error message is 'Error: listen EADDRINUSE: address already in use :::3000' then that means there is another application using the port, this could be another process of Crimson!")
})
const port = 3000
server.listen(port, () => { })

//? Generate a valid path
function resolvePath(extension, file) {
    return `.\\..\\Extensions\\${extension}\\${file}`
}

//! Read and run extension
//? Run extensions
var extensions = null
try {
    extensions = fs.readdirSync("../Extensions/")
} catch (err) {
    extensions = []
}

const actsas = []

for (const extension of extensions) {
    for (const thing of require(`../Extensions/${extension}/extension.json`).actsas) {
        actsas.push(thing)
    }
}

extensions.forEach((extension) => {
    var cfg = require(`../Extensions/${extension}/config.json`)
    var enabled = cfg.enabled
    if (enabled === "true") {
        var extensionstate = "enabled"
    } else {
        var extensionstate = "disabled"
    }
    var metadata = require(`../Extensions/${extension}/extension.json`)
    var dep = metadata.dependencies
    if (!extensionstate === "disabled") {
        for (const depe of dep) {
            if (!extensions.includes(depe) && !actsas.includes(depe)) {
                var extensionstate = "disabled"
            }
        }
    }
    if (extensionstate === "enabled") {
        console.start(`Loading ${metadata.name} by ${metadata.authors}...`)
        try {
            if (fs.existsSync(`../Extensions/${extension}/index.js`)){
                var code = fs.readFileSync(`../Extensions/${extension}/index.js`, "utf8")
            } else {
                var code = ""
            }
            const sandbox = {
                client,
                console,
                fetch,
                fs,
                path,
                global,
                require,
                __dirname,
                extension,
                extensions,
                guilds: client.guilds.cache,
                resolvePath: (thing, ext = extension) =>
                    resolvePath(ext, thing),
                setInterval: setInterval
            }
            vm.createContext(sandbox)
            vm.runInContext(`const net = require('net')

const extensionHandler = net.createConnection({ port: ${port} }, () => {
    console.start('Successfully loaded ${metadata.name}')
})

function sendData(data) {
    extensionHandler.write(data.replaceAll("ܛ", "\\u071B")+"ܛ")
}

sendData("SYSMSG ID=${metadata.id}")

function addTagCommand(tags, callback) {
    sendData(JSON.stringify({
        type: "addTag",
        info: {
            tag: tags,
            function: callback.toString()
        }
    }))
}

function sendDataToExtension(extension, data) {
    sendData(JSON.stringify({
        type: "sendDataTo",
        info: {
            extension: extension,
            message: data
        }
    }))
}`+ code, sandbox)
        } catch (err) {
            if (fs.existsSync(`../Extensions/${extension}/index.js`)) {
                console.warn(`${metadata.name} ran into an error running the index.js file`)
                console.err(err)
            }
        }
        var commandFilesExtension = null
        var workflows = null
        try {
            commandFilesExtension = fs.readdirSync(`../Extensions/${extension}/triggers/commands/`)
                .filter((file) => file.endsWith(".js"))
        } catch (err) {
            commandFilesExtension = []
        }

        try {
            workflows = fs.readdirSync(`../Extensions/${extension}/triggers/workflows/`).filter((file) => file.endsWith(".json"))
        } catch (err) {
            workflows = []
        }

        for (const file of commandFilesExtension) {
            const filePath = path.join(`../Extensions/${extension}/triggers/commands/`, file)
            const command = require(filePath)
            if ("execute" in command) {
                try {
                    client.commands.set(command.data.name, command)
                } catch (err) {
                    client.commands.set(command.name, command)
                }
            } else {
                console.warn(`The command at ${filePath} is missing a required "execute" property.`)
            }
        }

        for (const workflow of workflows) {
            const filePath = path.join(`../Extensions/${extension}/triggers/workflows/`, workflow)
            const context = {
                client,
                require
            }
            const data = require(filePath)
            var filebuilder = "const { Events, EmbedBuilder } = require('discord.js')\n"

            if (data.type === "message") {
                filebuilder += "client.on(Events.MessageCreate, async message => {\n"
                var ifstring = []

                if (data.requirements.startsWith) {
                    var thing = data.requirements.startsWith
                    var start = "!message.toString()"
                    if (data.requirements.caseSensitive === "false") {
                        start += ".toLowerCase()"
                        thing = thing.toLowerCase()
                    }
                    start += `.startsWith("${thing}")`
                    ifstring.push(start)
                }

                if (data.requirements.contains) {
                    for (var thing of data.requirements.contains) {
                        var start = "!message.toString()"
                        if (data.requirements.caseSensitive === "false") {
                            start += ".toLowerCase()"
                            thing = thing.toLowerCase()
                        }
                        start += `.includes("${thing}")`
                        ifstring.push(start)
                    }
                }

                if (data.requirements.endsWith) {
                    var thing = data.requirements.endsWith
                    var start = "!message.toString()"
                    if (data.requirements.caseSensitive === "false") {
                        start += ".toLowerCase()"
                        thing = thing.toLowerCase()
                    }
                    start += `.endsWith("${thing}")`
                    ifstring.push(start)
                }

                filebuilder += `    if(${ifstring.join(" || ")}) {return false} else {\n`

                if (data.actions.react) {
                    filebuilder += `        message.react('${data.actions.react}')\n`
                }

                if (data.actions.reply) {
                    filebuilder += `    message.reply(\`${data.actions.reply.content.replaceAll("${user}", "<@${member.user.id}>")}\`)\n`
                }

                if (data.actions.embed) {
                    filebuilder += `    const embed = new EmbedBuilder()`

                    if (data.actions.embed.title) {
                        filebuilder += `.setTitle(\`${data.actions.embed.title.replaceAll("${user}", "<@${member.user.id}>")}\`)`
                    }

                    if (data.actions.embed.content) {
                        filebuilder += `.setDescription(\`${data.actions.embed.content.replaceAll("${user}", "<@${member.user.id}>")}\`)`
                    }

                    if (data.actions.embed.color) {
                        filebuilder += `.setColor('${data.actions.embed.color}')`
                    }

                    filebuilder += `\n    client.channels.cache.find(channel => channel.name === "${data.actions.embed.channel}" && member.guild.id === channel.guild.id).send({ embeds: [embed]})\n`
                }

                filebuilder += "    }\n})"
            } else if (data.type === "memberAdd") {
                filebuilder += "client.on(Events.GuildMemberAdd, async member => {\n"

                if (data.actions.message) {
                    filebuilder += `    client.channels.cache.find(channel => channel.name === "${data.actions.message.channel}" && member.guild.id === channel.guild.id).send(\`${data.actions.message.content.replaceAll("${user}", "<@${member.user.id}>")}\`)\n`
                }

                if (data.actions.embed) {
                    filebuilder += `    const embed = new EmbedBuilder()`

                    if (data.actions.embed.title) {
                        filebuilder += `.setTitle(\`${data.actions.embed.title.replaceAll("${user}", "<@${member.user.id}>")}\`)`
                    }

                    if (data.actions.embed.content) {
                        filebuilder += `.setDescription(\`${data.actions.embed.content.replaceAll("${user}", "<@${member.user.id}>")}\`)`
                    }

                    if (data.actions.embed.color) {
                        filebuilder += `.setColor('${data.actions.embed.color}')`
                    }

                    filebuilder += `\n    client.channels.cache.find(channel => channel.name === "${data.actions.embed.channel}" && member.guild.id === channel.guild.id).send({ embeds: [embed]})\n`
                }

                filebuilder += "})"
            }

            vm.createContext(context)

            try {
                vm.runInContext(filebuilder, context)
            } catch (err) {
                console.err(`Failed to run workflow from ${extension}, file "${workflow}" may have errors!`)
                console.err(err)
            }
        }
    }
})
//*
//* Command execution
//*

//? Handle slash command execution
client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.isChatInputCommand()) {
        const command = interaction.client.commands.get(interaction.commandName)

        if (!command) {
            console.err(`No command matching ${interaction.commandName} was found.`)
            return
        }
        try {
            await command.execute(interaction, client)
        } catch (error) {
            console.err(error)
            try {
                await interaction.reply({
                    content:
                        "Uh oh, something went wrong! Contact the owner of the bot.",
                    ephemeral: true,
                })
            } catch (err) {
                try {
                    await interaction.editReply({
                        content:
                            "Uh oh, something went wrong! Contact the owner of the bot.",
                        ephemeral: true,
                    })
                } catch (e) {
                    try {
                        await interaction.followUp({
                            content:
                                "Uh oh, something went wrong! Contact the owner of the bot.",
                            ephemeral: true,
                        })
                    } catch (errr) {
                        console.err(errr)
                    }
                }
            }
        }
    } else return
})

//? Handle tag command execution
client.on(Events.MessageCreate, async message => {
    for (const i of tagsList) {
        if (i.tag instanceof Array) {
            for (const j of i.tag) {
                if (message.toString().startsWith(j)) {
                    i.function(message, i.tag.indexOf(j))
                }
            }
        }
        if (message.toString().startsWith(i.tag)) {
            i.function(message)
        }
    }
})

//*
//* Misc
//*

//? Handle GUI calls
if (process.argv.includes("--gui")) {
    process.stdin.on("data", (data) => {
        var message = JSON.parse(data.toString().trim())
        if (message.type === "END") {
            client.user.setPresence({ activities: [{ name: 'the offline game' }], status: 'dnd' })
            process.exit()
        } else if (message.type === "RC") {
            command.deploy(client.guilds.cache)
        }
    })
}

//? Make bot go invisible as soon as the bot is shut down
process.on("exit", function () {
    client.user.setPresence({ activities: [{ name: 'the offline game' }], status: 'dnd' })
})