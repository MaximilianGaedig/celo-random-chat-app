import Web3 from 'web3'
import {newKitFromWeb3} from '@celo/contractkit'
import erc20Abi from '../contract/erc20.abi.json'
import chatAbi from '../contract/chat.abi.json'
import {MDCTextField} from '@material/textfield';
import {MDCRipple} from '@material/ripple';

let kit
let contract
let isMatched = false
let isWaiting
const ERC20_DECIMALS = 18
const MPContractAddress = "0xd803473656Fffe95dE5bdc14721e88268836A99B"
const cUSDContractAddress = "0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1"
const messageLog = document.querySelector(".log")
const messageField = document.querySelector(".mdc-text-field__input")
const submitButton = document.querySelector(".mdc-fab")

// noinspection JSCheckFunctionSignatures
new MDCTextField(document.querySelector('.mdc-text-field'));
// noinspection JSCheckFunctionSignatures
new MDCRipple(submitButton);

// connect the Celo wallet
const connectCeloWallet = async () => {
    if (window.celo) {
        try {
            console.log("⚠️ Please approve this DApp to use it.")
            await window.celo.enable()
            const web3 = new Web3(window.celo)
            kit = newKitFromWeb3(web3)

            let accounts = await kit.web3.eth.getAccounts()
            kit.defaultAccount = accounts[0]
            document.querySelector("#youPicture").innerHTML = identiconTemplate(kit.defaultAccount)
            contract = new kit.web3.eth.Contract(chatAbi, MPContractAddress)
            // ugly account switching as I couldn't figure out how to do it with celo
            setInterval(async () => {
                accounts = await kit.web3.eth.getAccounts()
                if (accounts[0] !== kit.defaultAccount) {
                    window.location.reload()
                }
            }, 1000)
        } catch (error) {
            console.log(`⚠️ ${error}.`)
        }
    } else {
        console.log("⚠️ Please install the CeloExtensionWallet.")
    }
}

// get messages from blockchain and sort them
const getMessages = async () => {
    const _messagesLengthSent = await contract.methods.getSentMessageCount().call()
    let _messages = []
    for (let i = 0; i < _messagesLengthSent; i++) {
        let _message = new Promise(async (resolve) => {
            let p = await contract.methods.getSentMessage(i).call()
            resolve({
                sender: "you",
                text: p[0],
                timestamp: p[1]
            })
        })
        _messages.push(_message)
    }
    const _messagesLengthReceived = await contract.methods.getReceivedMessageCount().call()
    for (let i = 0; i < _messagesLengthReceived; i++) {
        let _message = new Promise(async (resolve) => {
            let p = await contract.methods.getReceivedMessage(i).call()
            resolve({
                sender: "other",
                text: p[0],
                timestamp: p[1]
            })
        })
        _messages.push(_message)
    }
    _messages = await Promise.all(_messages)
    renderMessages(_messages.sort(function (x, y) {
        return x.timestamp - y.timestamp;
    }))
}


// get balance of Celo and cUSD from wallet and write it to screen
const getBalance = async function () {
    const totalBalance = await kit.getTotalBalance(kit.defaultAccount)
    document.querySelector("#cleoBal").textContent =
        "Celo: " + totalBalance.CELO.shiftedBy(-ERC20_DECIMALS).toFixed(2)
    document.querySelector("#cUSDBal").textContent =
        "cUSD: " + totalBalance.cUSD.shiftedBy(-ERC20_DECIMALS).toFixed(2)
}

// write messages to chat log
const renderMessages = (messages) => {
    messageLog.innerHTML = ""
    messages.forEach((_message) => {
        const message = document.createElement("div")
        message.innerHTML = `<div class="message ${_message.sender}">${_message.text}</div>`
        messageLog.appendChild(message.firstChild)
    })
}

// template for identification of an address
const identiconTemplate = (_address) => {
    const icon = blockies
        .create({
            seed: _address,
            size: 8,
            scale: 16,
        })
        .toDataURL()

    return `
    <a href="https://alfajores-blockscout.celo-testnet.org/address/${_address}/transactions"
        target="_blank">
        <img src="${icon}" width="48" alt="${_address}" style="border-radius: 50%;">
    </a>
  `
}

// assign address to your address
const assignAddress = async () => {
    isWaiting = true
    document.querySelector("#status").textContent = "Waiting for address match with"
    document.querySelector("#topBtn").disabled = true
    const status = await contract.methods.assignAddress().send({from: kit.defaultAccount})
    console.log(status)
}

// remove matched address
const removeMatch = async () => {
    await contract.methods.removeMatch().send({from: kit.defaultAccount})
    await checkAddressAssignment()
}

// checks if address is assigned to another address,
// changes the isMatched value accordingly and
// changes the status button to reflect that
const checkAddressAssignment = async () => {
    const assignment = await contract.methods.isAddressAssigned().call()
    if (assignment) {
        const matchedAddress = await contract.methods.getAssignedAddress().call()
        document.querySelector("#otherPicture").innerHTML =
            identiconTemplate(matchedAddress)
        document.querySelector("#status").textContent = "Unmatch with " + matchedAddress
        document.querySelector("#topBtn").disabled = false
        submitButton.disabled = false
        isMatched = true
    } else if (isWaiting) {
        document.querySelector("#otherPicture").innerHTML = ""
        document.querySelector("#status").textContent = "Waiting for address match with"
        document.querySelector("#topBtn").disabled = true
        submitButton.disabled = true
        isMatched = false
    } else {
        document.querySelector("#otherPicture").innerHTML = ""
        document.querySelector("#status").textContent = "Announce that you want a partner"
        document.querySelector("#topBtn").disabled = false
        submitButton.disabled = true
        isMatched = false
        isWaiting = false
    }
    setTimeout(checkAddressAssignment, 10000)
}


const approve = async (_price) => {
    const cUSDContract = new kit.web3.eth.Contract(erc20Abi, cUSDContractAddress)

    return await cUSDContract.methods
        .approve(MPContractAddress, _price)
        .send({from: kit.defaultAccount})
}

// decides what to do when top button is pressed
document.querySelector("#topBtn").addEventListener("click", async () => {
    if (isWaiting) {
        return
    }
    if (isMatched) {
        await removeMatch()
    } else {
        await assignAddress()
    }
})

// sends a message on click of the send button
submitButton.addEventListener("click", async () => {
    if (messageField.value !== "") {
        console.log('⌛ Sending message...')
        try {
            await contract.methods
                .writeMessage(messageField.value)
                .send({from: kit.defaultAccount})
            messageField.value = ""
        } catch (error) {
            console.log(`⚠️ ${error}.`)
        }
        console.log("🎉 You successfully sent a message.")
        await getMessages()
    }
})


// document
//     .querySelector("#openChatBtn")
// .addEventListener("click", () => {
//     const _product = {
//         owner: "0x2EF48F32eB0AEB90778A2170a0558A941b72BFFb",
//         name: document.getElementById("newProductName").value,
//         image: document.getElementById("newImgUrl").value,
//         description: document.getElementById("newProductDescription").value,
//         location: document.getElementById("newLocation").value,
//         price: document.getElementById("newPrice").value,
//         sold: 0,
//         index: products.length,
//     }
//     products.push(_product)
//     notification(`🎉 You successfully added "${_product.name}".`)
//     renderProducts()
// })

// document.querySelector("#marketplace").addEventListener("click", async (e) => {
//     if (e.target.className.includes("buyBtn")) {
//         const index = e.target.id
//         console.log("⌛ Waiting for payment approval...")
//         try {
//             await approve(messages[index].price)
//         } catch (error) {
//             console.log(`⚠️ ${error}.`)
//         }
//         console.log(`⌛ Awaiting payment for "${products[index].name}"...`)
//         try {
//             const result = await contract.methods
//                 .buyProduct(index)
//                 .send({from: kit.defaultAccount})
//             console.log(`🎉 You successfully bought "${products[index].name}".`)
//             getProducts()
//             getBalance()
//         } catch (error) {
//             console.log(`⚠️ ${error}.`)
//         }
//     }
// })


// initializes application
window.addEventListener('load', async () => {
    await connectCeloWallet()
    await getMessages()
    await getBalance()
    isWaiting = await contract.methods.isWaiting().call()
    if (!isWaiting) document.querySelector("#topBtn").disabled = false
    await checkAddressAssignment()
})
