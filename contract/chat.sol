// SPDX-License-Identifier: MIT

pragma solidity >=0.7.0 <0.9.0;

import "hardhat/console.sol";

interface IERC20Token {
    function transfer(address, uint256) external returns (bool);

    function approve(address, uint256) external returns (bool);

    function transferFrom(address, address, uint256) external returns (bool);

    function totalSupply() external view returns (uint256);

    function balanceOf(address) external view returns (uint256);

    function allowance(address, address) external view returns (uint256);

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
}

contract Chat {
    address internal waitingAddress = 0x0000000000000000000000000000000000000000;
    address internal cUsdTokenAddress = 0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1;


    struct Message {
        address sender;
        string text;
        uint timestamp;
    }


    mapping(address => address) internal addresses;
    mapping(address => mapping(uint => Message)) internal messages;
    mapping(address => uint) internal messageAmounts;


    // assigns an address to an address if there's one waiting,
    // if not, it makes the sender address the address that is waiting
    function assignAddress() public {
        if (waitingAddress == 0x0000000000000000000000000000000000000000) {
            waitingAddress = msg.sender;
        } else if (waitingAddress != msg.sender) {
            addresses[msg.sender] = waitingAddress;
            addresses[waitingAddress] = msg.sender;
            waitingAddress = 0x0000000000000000000000000000000000000000;
        }
    }
    // says if address is waiting
    function isWaiting() public view returns (bool){
        return msg.sender == waitingAddress;
    }

    // returns a boolean that says if the adress has a recipient / is assigned
    function isAddressAssigned() public view returns (bool){
        return addresses[msg.sender] != 0x0000000000000000000000000000000000000000;
    }

    // returns assigned address
    function getAssignedAddress() public view returns (address){
        return addresses[msg.sender];
    }

    function infoConsole() public view {
        console.log(msg.sender);
        console.log(addresses[msg.sender]);
        console.log(addresses[addresses[msg.sender]]);
    }
    // writes a message to someone
    function writeMessage(string memory _text) public {
        if (isAddressAssigned()) {
            address destination = addresses[msg.sender];
            messages[destination][messageAmounts[destination]++] = Message(
                msg.sender,
                _text,
                block.timestamp
            );
        }
    }
    // transfers funds and sends a confirmation message to someone
    function transferFunds(uint _amount) public payable {
        if (isAddressAssigned()) {
            require(
                IERC20Token(cUsdTokenAddress).transferFrom(
                    msg.sender,
                    addresses[msg.sender],
                    _amount
                ),
                "Transfer failed."
            );
            writeMessage(string(abi.encodePacked("cUSD--", uint2str(_amount))));
        }

    }

    // gets the length of the received message mapping of an adress
    function getReceivedMessageCount() public view returns (uint){
        return (messageAmounts[msg.sender]);
    }

    // gets the length of the sent message mapping of an adress
    function getSentMessageCount() public view returns (uint){
        return (messageAmounts[addresses[msg.sender]]);
    }

    // gets a received message based on index
    function getReceivedMessage(uint _index) public view returns (string memory, uint){
        return (
        messages[msg.sender][_index].text,
        messages[msg.sender][_index].timestamp
        );
    }

    // gets a sent message based on index
    function getSentMessage(uint _index) public view returns (string memory, uint){
        return (
        messages[addresses[msg.sender]][_index].text,
        messages[addresses[msg.sender]][_index].timestamp
        );
    }

    // removes a match
    function removeMatch() public {
        if (addresses[msg.sender] != 0x0000000000000000000000000000000000000000) {
            // delete recived messages
            for (uint i = 0; i == messageAmounts[msg.sender]; i++) {
                delete messages[msg.sender][i];
            }
            // delete sent messages
            for (uint i = 0; i == messageAmounts[addresses[msg.sender]]; i++) {
                delete messages[addresses[msg.sender]][i];
            }
            delete messageAmounts[addresses[msg.sender]];
            delete messageAmounts[msg.sender];
            delete addresses[addresses[msg.sender]];
            delete addresses[msg.sender];
        }
    }

    // converts a number into a string
    function uint2str(uint _i) internal pure returns (string memory _uintAsString) {
        if (_i == 0) {
            return "0";
        }
        uint j = _i;
        uint len;
        while (j != 0) {
            len++;
            j /= 10;
        }
        bytes memory bstr = new bytes(len);
        uint k = len;
        while (_i != 0) {
            k = k - 1;
            uint8 temp = (48 + uint8(_i - _i / 10 * 10));
            bytes1 b1 = bytes1(temp);
            bstr[k] = b1;
            _i /= 10;
        }
        return string(bstr);
    }
}
