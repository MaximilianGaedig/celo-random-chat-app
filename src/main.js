import Web3 from 'web3'
import {newKitFromWeb3} from '@celo/contractkit'
import erc20Abi from '../contract/erc20.abi.json'
import chatAbi from '../contract/chat.abi.json'
import {MDCTextField} from '@material/textfield';
import {MDCRipple} from '@material/ripple';
import {MDCDialog} from '@material/dialog';
import BigNumber from "bignumber.js";
import {chatContractAddress, ERC20_DECIMALS, cUSDContractAddress} from "./utils/constants";

let kit
let contract
let isMatched = false
let isWaiting
let isTransacting
let lastMessages

const messageLog = document.querySelector(".log")
const messageField = document.querySelector("[aria-labelledby=chat-message-label]")
const paymentField = document.querySelector("[aria-labelledby=price-label]")
const sendButton = document.querySelector("#sendBtn")
const payButton = document.querySelector("#payBtn")

// noinspection JSCheckFunctionSignatures
new MDCTextField(document.querySelectorAll('.mdc-text-field')[0]);
// noinspection JSCheckFunctionSignatures
new MDCTextField(document.querySelectorAll('.mdc-text-field')[1]);
// noinspection JSCheckFunctionSignatures
new MDCRipple(sendButton);
// noinspection JSCheckFunctionSignatures
new MDCRipple(payButton);
// noinspection JSCheckFunctionSignatures
const dialog = new MDCDialog(document.querySelector('.mdc-dialog'));

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
            contract = new kit.web3.eth.Contract(chatAbi, chatContractAddress)
            // ugly account switching as I couldn't figure out how to do it with celo
            setInterval(async () => {
                accounts = await kit.web3.eth.getAccounts()
                if (accounts[0] !== kit.defaultAccount) {
                    window.location.reload()
                }
            }, 1000)
        } catch (error) {
            console.log(`⚠️ ${error}.`)
            document.querySelector("#status").textContent = "Please install the CeloExtensionWallet"
        }
    } else {
        document.querySelector("#status").textContent = "Please install the CeloExtensionWallet"
    }
}

// write messages to chat log
const renderMessages = (messages) => {
    let messagesString = ""
    messages.forEach((_message) => {
        const payment = _message.text.slice(0, 6) === 'cUSD--'
        if (payment) {
            _message.text = new BigNumber(_message.text.slice(6))
            _message.text = _message.text.shiftedBy(-ERC20_DECIMALS) + "$"
        }
        messagesString += `<div class="message ${_message.sender}${payment ? ' payment' : ''}">${_message.text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/"/g, '&quot;')}</div>`
    })
    if (messagesString !== lastMessages) {
        lastMessages = messagesString
        messageLog.innerHTML = messagesString
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

// refresh messages every second
const messagesRefresh = async () => {
    await getMessages()
    setTimeout(messagesRefresh, 1000)
}

// get balance of Celo and cUSD from wallet and write it to screen
const getBalance = async function () {
    const totalBalance = await kit.getTotalBalance(kit.defaultAccount)
    document.querySelector("#cleoBal").textContent =
        "Celo: " + totalBalance.CELO.shiftedBy(-ERC20_DECIMALS).toFixed(2)
    document.querySelector("#cUSDBal").textContent =
        "cUSD: " + totalBalance.cUSD.shiftedBy(-ERC20_DECIMALS).toFixed(2)
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
    await contract.methods.assignAddress().send({from: kit.defaultAccount})
}

// remove matched address
const removeMatch = async () => {
    await contract.methods.removeMatch().send({from: kit.defaultAccount})
}

// checks if address is assigned to another address,
// changes the isMatched value accordingly and
// changes the status button to reflect that
const checkAddressAssignment = async () => {
    const assignment = await contract.methods.isAddressAssigned().call()
    if (isTransacting) {
        setTimeout(checkAddressAssignment, 1000)
        return
    }

    if (assignment) {
        const matchedAddress = await contract.methods.getAssignedAddress().call()
        if (document.querySelector("#otherPicture").innerHTML !== identiconTemplate(matchedAddress)) {
            document.querySelector("#otherPicture").innerHTML =
                identiconTemplate(matchedAddress)
        }
        document.querySelector("#status").textContent = "Unmatch with " + matchedAddress
        document.querySelector("#topBtn").disabled = false
        sendButton.style.display = ''
        payButton.style.display = ''
        messageField.disabled = false
        document.querySelector(".chat-field").classList.remove("mdc-text-field--disabled")
        isMatched = true
        setTimeout(checkAddressAssignment, 1000)
        return
    }
    if (isWaiting) {
        document.querySelector("#otherPicture").innerHTML = ""
        document.querySelector("#status").textContent = "Waiting for address match with"
        document.querySelector("#topBtn").disabled = true
        sendButton.style.display = 'none'
        payButton.style.display = 'none'
        messageField.disabled = true
        isMatched = false
        setTimeout(checkAddressAssignment, 1000)
        return
    }

    document.querySelector("#otherPicture").innerHTML = ""
    document.querySelector("#status").textContent = "Announce that you want a partner"
    document.querySelector("#topBtn").disabled = false
    sendButton.style.display = 'none'
    payButton.style.display = 'none'
    messageField.disabled = true
    isMatched = false
    isWaiting = false
    setTimeout(checkAddressAssignment, 1000)

}


const approve = async (_price) => {
    const cUSDContract = new kit.web3.eth.Contract(erc20Abi, cUSDContractAddress)

    return await cUSDContract.methods
        .approve(chatContractAddress, _price)
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
sendButton.addEventListener("click", async () => {
    if (messageField.value) {
        console.log('⌛ Sending message...')
        sendButton.style.display = 'none'
        payButton.style.display = 'none'
        messageField.disabled = true
        isTransacting = true
        try {
            await contract.methods
                .writeMessage(messageField.value)
                .send({from: kit.defaultAccount})
            messageField.value = ""
            console.log("🎉 Sent message")
            await getMessages()
            await getBalance()
        } catch (error) {
            console.log(`⚠️ ${error}.`)
        }
        sendButton.style.display = ''
        payButton.style.display = ''
        messageField.disabled = false
        isTransacting = false
        document.querySelector(".chat-field").classList.remove("mdc-text-field--disabled")
    }
})

payButton.addEventListener("click", async () => {
    console.log("⌛ Waiting for payment approval...")
    sendButton.style.display = 'none'
    payButton.style.display = 'none'
    messageField.disabled = true
    isTransacting = true
    dialog.open()
    let price
    await new Promise((resolve) => {
        dialog.listen('MDCDialog:closing', (e) => {
            if (e.detail.action === 'accept'){
                price = new BigNumber(paymentField.value)
                price = price.shiftedBy(ERC20_DECIMALS)
            }
            resolve()
        })
    })
    try {
        await approve(price)
    } catch (error) {
        console.log(`⚠️ ${error}.`)
    }
    console.log("⌛ Awaiting payment...")
    try {
        await contract.methods
            .transferFunds(price)
            .send({from: kit.defaultAccount})
        console.log("🎉 Transferred funds")
        await getMessages()
        await getBalance()
    } catch (error) {
        console.log(`⚠️ ${error}.`)
    }
    sendButton.style.display = ''
    payButton.style.display = ''
    messageField.disabled = false
    isTransacting = false
    document.querySelector(".chat-field").classList.remove("mdc-text-field--disabled")
})


// initializes application
window.addEventListener('load', async () => {
    await connectCeloWallet()
    isWaiting = await contract.methods.isWaiting().call()
    if (!isWaiting) document.querySelector("#topBtn").disabled = false
    await checkAddressAssignment()
    await getMessages()
    await getBalance()
    await messagesRefresh()
})
