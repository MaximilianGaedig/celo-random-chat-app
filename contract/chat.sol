// SPDX-License-Identifier: MIT

pragma solidity >=0.7.0 <0.9.0;

import "hardhat/console.sol";

interface IERC20Token {
    function transfer(address, uint256) external returns (bool);

    function approve(address, uint256) external returns (bool);

    function transferFrom(
        address,
        address,
        uint256
    ) external returns (bool);

    function totalSupply() external view returns (uint256);

    function balanceOf(address) external view returns (uint256);

    function allowance(address, address) external view returns (uint256);

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(
        address indexed owner,
        address indexed spender,
        uint256 value
    );
}

library SafeMath {
    /**
     * @dev Returns the addition of two unsigned integers, reverting on
     * overflow.
     *
     * Counterpart to Solidity's `+` operator.
     *
     * Requirements:
     *
     * - Addition cannot overflow.
     */
    function add(uint256 a, uint256 b) internal pure returns (uint256) {
        uint256 c = a + b;
        require(c >= a, "SafeMath: addition overflow");

        return c;
    }

    /**
     * @dev Returns the subtraction of two unsigned integers, reverting on
     * overflow (when the result is negative).
     *
     * Counterpart to Solidity's `-` operator.
     *
     * Requirements:
     *
     * - Subtraction cannot overflow.
     */
    function sub(uint256 a, uint256 b) internal pure returns (uint256) {
        return sub(a, b, "SafeMath: subtraction overflow");
    }

    /**
     * @dev Returns the subtraction of two unsigned integers, reverting with custom message on
     * overflow (when the result is negative).
     *
     * Counterpart to Solidity's `-` operator.
     *
     * Requirements:
     *
     * - Subtraction cannot overflow.
     */
    function sub(
        uint256 a,
        uint256 b,
        string memory errorMessage
    ) internal pure returns (uint256) {
        require(b <= a, errorMessage);
        uint256 c = a - b;

        return c;
    }

    /**
     * @dev Returns the multiplication of two unsigned integers, reverting on
     * overflow.
     *
     * Counterpart to Solidity's `*` operator.
     *
     * Requirements:
     *
     * - Multiplication cannot overflow.
     */
    function mul(uint256 a, uint256 b) internal pure returns (uint256) {
        // Gas optimization: this is cheaper than requiring 'a' not being zero, but the
        // benefit is lost if 'b' is also tested.
        // See: https://github.com/OpenZeppelin/openzeppelin-contracts/pull/522
        if (a == 0) {
            return 0;
        }

        uint256 c = a * b;
        require(c / a == b, "SafeMath: multiplication overflow");

        return c;
    }

    /**
     * @dev Returns the integer division of two unsigned integers. Reverts on
     * division by zero. The result is rounded towards zero.
     *
     * Counterpart to Solidity's `/` operator. Note: this function uses a
     * `revert` opcode (which leaves remaining gas untouched) while Solidity
     * uses an invalid opcode to revert (consuming all remaining gas).
     *
     * Requirements:
     *
     * - The divisor cannot be zero.
     */
    function div(uint256 a, uint256 b) internal pure returns (uint256) {
        return div(a, b, "SafeMath: division by zero");
    }

    /**
     * @dev Returns the integer division of two unsigned integers. Reverts with custom message on
     * division by zero. The result is rounded towards zero.
     *
     * Counterpart to Solidity's `/` operator. Note: this function uses a
     * `revert` opcode (which leaves remaining gas untouched) while Solidity
     * uses an invalid opcode to revert (consuming all remaining gas).
     *
     * Requirements:
     *
     * - The divisor cannot be zero.
     */
    function div(
        uint256 a,
        uint256 b,
        string memory errorMessage
    ) internal pure returns (uint256) {
        require(b > 0, errorMessage);
        uint256 c = a / b;
        // assert(a == b * c + a % b); // There is no case in which this doesn't hold

        return c;
    }

    /**
     * @dev Returns the remainder of dividing two unsigned integers. (unsigned integer modulo),
     * Reverts when dividing by zero.
     *
     * Counterpart to Solidity's `%` operator. This function uses a `revert`
     * opcode (which leaves remaining gas untouched) while Solidity uses an
     * invalid opcode to revert (consuming all remaining gas).
     *
     * Requirements:
     *
     * - The divisor cannot be zero.
     */
    function mod(uint256 a, uint256 b) internal pure returns (uint256) {
        return mod(a, b, "SafeMath: modulo by zero");
    }

    /**
     * @dev Returns the remainder of dividing two unsigned integers. (unsigned integer modulo),
     * Reverts with custom message when dividing by zero.
     *
     * Counterpart to Solidity's `%` operator. This function uses a `revert`
     * opcode (which leaves remaining gas untouched) while Solidity uses an
     * invalid opcode to revert (consuming all remaining gas).
     *
     * Requirements:
     *
     * - The divisor cannot be zero.
     */
    function mod(
        uint256 a,
        uint256 b,
        string memory errorMessage
    ) internal pure returns (uint256) {
        require(b != 0, errorMessage);
        return a % b;
    }
}

contract Chat {
    address internal waitingAddress;
    address internal cUsdTokenAddress =
        0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1;
    using SafeMath for uint256;

    struct Message {
        address sender;
        string text;
        uint256 timestamp;
    }

    mapping(address => address) internal addresses;
    mapping(address => mapping(uint256 => Message)) internal messages;
    mapping(address => uint256) internal messageAmounts;

    // assigns an address to an address if there's one waiting,
    // if not, it makes the sender address the address that is waiting
    function assignAddress() public {
        if (waitingAddress == address(0)) {
            waitingAddress = msg.sender;
        } else if (waitingAddress != msg.sender) {
            addresses[msg.sender] = waitingAddress;
            addresses[waitingAddress] = msg.sender;
            waitingAddress = address(0);
        }
    }

    // says if address is waiting
    function isWaiting() public view returns (bool) {
        return msg.sender == waitingAddress;
    }

    // returns a boolean that says if the address has a recipient / is assigned
    function isAddressAssigned() public view returns (bool) {
        return addresses[msg.sender] != address(0);
    }

    // returns assigned address
    function getAssignedAddress() public view returns (address) {
        return addresses[msg.sender];
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
    function transferFunds(uint256 _amount) public payable {
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
    function getReceivedMessageCount() public view returns (uint256) {
        return (messageAmounts[msg.sender]);
    }

    // gets the length of the sent message mapping of an adress
    function getSentMessageCount() public view returns (uint256) {
        return (messageAmounts[addresses[msg.sender]]);
    }

    // gets a received message based on index
    function getReceivedMessage(uint256 _index)
        public
        view
        returns (string memory, uint256)
    {
        return (
            messages[msg.sender][_index].text,
            messages[msg.sender][_index].timestamp
        );
    }

    // gets a sent message based on index
    function getSentMessage(uint256 _index)
        public
        view
        returns (string memory, uint256)
    {
        return (
            messages[addresses[msg.sender]][_index].text,
            messages[addresses[msg.sender]][_index].timestamp
        );
    }

    // removes a match
    function removeMatch() public {
        if (addresses[msg.sender] != address(0)) {
            // delete recived messages
            for (uint256 i = 0; i == messageAmounts[msg.sender]; i++) {
                delete messages[msg.sender][i];
            }
            // delete sent messages
            for (
                uint256 i = 0;
                i == messageAmounts[addresses[msg.sender]];
                i++
            ) {
                delete messages[addresses[msg.sender]][i];
            }
            delete messageAmounts[addresses[msg.sender]];
            delete messageAmounts[msg.sender];
            delete addresses[addresses[msg.sender]];
            delete addresses[msg.sender];
        }
    }

    // converts a number into a string
    function uint2str(uint256 _i)
        internal
        pure
        returns (string memory _uintAsString)
    {
        if (_i == 0) {
            return "0";
        }
        uint256 j = _i;
        uint256 len;
        while (j != 0) {
            len++;
            j /= 10;
        }
        bytes memory bstr = new bytes(len);
        uint256 k = len;
        while (_i != 0) {
            k = k - 1;
            uint8 temp = (48 + uint8(_i - (_i / 10) * 10));
            bytes1 b1 = bytes1(temp);
            bstr[k] = b1;
            _i /= 10;
        }
        return string(bstr);
    }
}
