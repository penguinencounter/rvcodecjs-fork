import {BASE, FIELD_COMMON, XLEN, OPCODE,
        FIELD_RTYPE, FIELD_ITYPE} from './Constants.js'

export class Instruction {
    /**
     * Creates an Instruction represented in multiple formats
     * @param {String} instruction
     */
    constructor(instruction) {
        // Create an array of fragments
        this.fragments = [];

        // Hard coded for now
        this.isa = "RV32I";

        // Determine format of instruction and decode
        this.decodeInstruction(instruction);

        // Print values of Instruction
        console.log("ASSEMBLY: " + this.assembly);
        console.log("BINARY: " + this.binary);
        console.log("HEXADECIMAL: " + this.hex);
        console.log("FORMAT: " + this.format);
        console.log("SET: " + this.isa);
        console.log(this.fragments);
    }

    // Check format of instruction and decode accordingly
    decodeInstruction(instruction) {
        // Regular expression for 32 bit binary instruction
        var binaryRegEx = /^[01]{32}$/;
        // Regular expression for 8 digit hexadecimal instruction
        var hexRegEx = /^(0x)?[0-9a-fA-F]{8}$/;

        // If instruction is in binary format
        if (binaryRegEx.test(instruction)) {
            this.binary = instruction;
            // Convert to hex
            this.hex = convertBinToHex(instruction);
            // Convert to assembly
            this.convertBinToAsm();
        // If instruction is in hex format
        } else if (hexRegEx.test(instruction)) {
            this.hex = instruction;
            // Convert to binary
            this.binary = convertHexToBin(instruction);
            // Convert to assembly
            this.convertBinToAsm();
        } else {
            throw "Invalid instruction";
        }
    }

    // Convert binary instruction to assembly
    convertBinToAsm() {
        // Use opcode to determine instruction type
        this.opcode = this.getBits(FIELD_COMMON.OPCODE.START,
                                    FIELD_COMMON.OPCODE.END);

        switch (this.opcode) {
            // R-TYPE
            case OPCODE.RTYPE:
                this.decodeRType();
                this.format = "R-TYPE";
                break;
            // I-TYPE
            case OPCODE.ITYPE:
            case OPCODE.JALR:
            case OPCODE.LOAD:
                this.decodeIType();
                this.format = "I-TYPE";
                break;
            // Invalid opcode
            default:
                throw "Invalid opcode";
        }
    }

    // Given start and end index, return corresponding bits
    getBits(indStart, indEnd) {
        return this.binary.substring(XLEN.RV32 - (indEnd + 1),
                                    XLEN.RV32 - indStart);
    }

    /**
     * Decodes R-type instruction
     * @returns {String} output
     */
    decodeRType() {
        // Define funct3 and funct7 bits
        let rfunct = {  "0000000000": "ADD",
                        "0000100000": "SUB",
                        "0010000000": "SLL",
                        "0100000000": "SLT",
                        "0110000000": "SLTU",
                        "1000000000": "XOR",
                        "1010000000": "SRL",
                        "1010100000": "SRA",
                        "1100000000": "OR",
                        "1110000000": "AND"
        };

        // Get bits for each field
        var rd = this.getBits(FIELD_COMMON.RD.START, FIELD_COMMON.RD.END);
        var funct3 = this.getBits(FIELD_COMMON.FUNCT3.START,
                                    FIELD_COMMON.FUNCT3.END);
        var rs1 = this.getBits(FIELD_COMMON.RS1.START, FIELD_COMMON.RS1.END);
        var rs2 = this.getBits(FIELD_COMMON.RS2.START, FIELD_COMMON.RS2.END);
        var funct7 = this.getBits(FIELD_RTYPE.FUNCT7.START,
                                    FIELD_RTYPE.FUNCT7.END);

        // Convert register numbers from binary to decimal
        var reg1 = convertBinRegister(rs1);
        var reg2 = convertBinRegister(rs2);
        var destReg = convertBinRegister(rd);

        // Check for operation in rfunct dictionary
        var funct = funct3 + funct7;
        if (funct in rfunct) {
            var operation = rfunct[funct];
        } else {
            throw "Invalid funct3 or funct7";
        }

        // Create fragments for each field
        this.fragments.push(new Fragment(operation, this.opcode,
                            FIELD_COMMON.OPCODE.START, "opcode"));
        this.fragments.push(new Fragment(operation, funct3,
                            FIELD_COMMON.FUNCT3.START, "funct3"));
        this.fragments.push(new Fragment(operation, funct7,
                            FIELD_RTYPE.FUNCT7.START, "funct7"));
        this.fragments.push(new Fragment(reg1, rs1,
                            FIELD_COMMON.RS1.START, "rs1"));
        this.fragments.push(new Fragment(reg2, rs2,
                            FIELD_COMMON.RS2.START, "rs2"));
        this.fragments.push(new Fragment(destReg, rd,
                            FIELD_COMMON.RD.START, "rd"));

        // Construct assembly instruction
        this.assembly = renderAsmInstruction([operation, destReg, reg1, reg2]);
    }

    /**
     * Decodes I-type instruction
     * @returns {String} output
     */
    decodeIType() {
        // Get bits for each field
        var rd = this.getBits(FIELD_COMMON.RD.START, FIELD_COMMON.RD.END);
        var funct3 = this.getBits(FIELD_COMMON.FUNCT3.START,
                                    FIELD_COMMON.FUNCT3.END);
        var rs1 = this.getBits(FIELD_COMMON.RS1.START, FIELD_COMMON.RS1.END);
        var highImm = this.getBits(FIELD_ITYPE.HIGHIMM.START,
                                    FIELD_ITYPE.HIGHIMM.END);

        // Set to true if operation is a shift (slli, srai, srli)
        var shift = false;

        // Define funct3 + opcode / high-order immediate bits
        var ifunct = {  // funct3 + opcode bits
                        "0000010011": "ADDI",
                        "0001100111": "JALR",
                        "0000000011": "LB",
                        "0010010011": "SLLI",
                        "0010000011": "LH",
                        "0100010011": "SLTI",
                        "0100000011": "LW",
                        "0110010011": "SLTIU",
                        "1000010011": "XORI",
                        "1000000011": "LBU",
                        "1010000011": "LHU",
                        "1100010011": "ORI",
                        "1110010011": "ANDI",
                        // funct3 + high-order immediate bits
                        "1010000000": "SRLI",
                        "1010100000": "SRAI"
        };

        var funct = funct3 + this.opcode;
        // SRAI/SRLI have the same opcode (use high-order immediate instead)
        if (funct3 == "101") {
            funct = funct3 + highImm;
        }

        // Check for operation using funct3 and opcode / high-order immediate
        if (funct in ifunct) {
            var operation = ifunct[funct];
        } else {
            throw "Invalid funct3";
        }

        // Check if operation is a shift
        var shiftOperations = ["SRLI", "SRAI", "SLLI"];
        if (shiftOperations.includes(operation)) {
            shift = true;
        }

        // Convert register numbers from binary to decimal
        var reg1 = convertBinRegister(rs1);
        var destReg = convertBinRegister(rd);

        // Create fragments for each field
        this.fragments.push(new Fragment(operation, this.opcode,
                                        FIELD_COMMON.OPCODE.START, "opcode"));
        this.fragments.push(new Fragment(operation, funct3,
                                        FIELD_COMMON.FUNCT3.START, "funct3"));
        this.fragments.push(new Fragment(reg1, rs1,
                                        FIELD_COMMON.RS1.START, "rs1"));
        this.fragments.push(new Fragment(destReg, rd,
                                        FIELD_COMMON.RD.START, "rd"));

        // For shift operations: can only use lower 5 bits of imm for shift
        if (shift) {
            // Get bits for shamt field
            var shamt = this.getBits(ITYPE.SHAMT.START, ITYPE.SHAMT.END);

            // Parse shamt bits to decimal
            var shiftAmt = parseInt(shamt, BASE.BINARY);

            // Create higher-order immediate fragment
            this.fragments.push(new Fragment(operation, highImm,
                        FIELD_ITYPE.HIGHIMM.START, "higher-order immediate"));
            // Create shamt fragment
            this.fragments.push(new Fragment(shiftAmt, shamt,
                        FIELD_ITYPE.SHAMT.START, "shamt"));

            // Construct assembly instruction
            this.assembly = renderAsmInstruction([operation, destReg, reg1,
                                                shamt]);

        } else {
            // Get bits for imm[11:0] field
            var imm = this.getBits(FIELD_ITYPE.IMM11.START,
                                    FIELD_ITYPE.IMM11.END);

            // Convert immediate from binary to decimal
            var immediate = parseImm(imm);

            // Create immediate fragment
            this.fragments.push(new Fragment(immediate, imm,
                                FIELD_ITYPE.IMM11.START, "imm[11:0]"));

            // Construct assembly instruction
            if (this.opcode == OPCODE.LOAD) {
                this.assembly = renderLoadStoreInstruction([operation, destReg,
                                                        immediate, reg1]);
            } else {
                this.assembly = renderAsmInstruction([operation, destReg, reg1,
                                                    immediate]);
            }
        }
    }
}

// Parse given immediate to decimal
function parseImm(immediate) {
    // If first bit is 1, binary string represents a negative number
    if (immediate[0] == '1') {
        // Pad binary with 1s and convert number to 32 bit integer
        return parseInt(immediate.padStart(32,'1'), BASE.BINARY) >> 0;
    }
    // Else, binary string represents 0 or positive number
    return parseInt(immediate, BASE.BINARY);
}

// Convert register numbers from binary to decimal
function convertBinRegister(reg) {
    return "x" + parseInt(reg, BASE.BINARY);
}

// Combine list of items into assembly instruction
function renderAsmInstruction(list) {
    // If list is empty, throw error
    if (list.length < 1) {
        throw "Empty list";
    }

    // Add first item
    var output = list[0];

    // If list has more than one item
    if (list.length > 1) {
        // Create sublist of following items
        var items = list.splice(1);
        // Add space before second item and separate next items with commas
        output = output + " " + items.join(", ");
    }
    return output;
}

// Combine list of items into load/store assembly instruction
function renderLoadStoreInstruction(list) {
    // If list is empty, throw error
    if (list.length < 1) {
        throw "Empty List";
    // If less than 4 items in list, throw error
    } else if (list.length < 4) {
        throw "Not enough items to render load/store instruction";
    }
    // Example of format: lw x2, 0(x8)
    return list[0] + " " + list[1] + ", " + list[2] + "(" + list[3] + ")";
}

// Convert hexadecimal to 32 bit binary string
function convertHexToBin(hex) {
    var bin = parseInt(hex, BASE.HEX).toString(BASE.BINARY);
    // Pad binary string with zeros while length < 32
    return bin.padStart(32, '0');
}

// Convert binary to 8 digit hexadecimal
function convertBinToHex(bin) {
    var hex = parseInt(bin, BASE.BINARY).toString(BASE.HEX);
    // Pad hex string with zeros while length < 8
    hex = hex.padStart(8, '0');
    // Add 0x prefix
    return '0x' + hex;
}

class Fragment {
    /**
     * Represents a fragment of the instruction
     * @param {String} assembly (ex. "x5")
     * @param {String} bits (ex. "01101")
     * @param {Number} index - start index of bits (ex. 7)
     * @param {String} field (ex. "rd")
     */
    constructor(assembly, bits, index, field) {
        this.assembly = assembly;
        this.bits = bits;
        this.index = index;
        this.field = field;
    }
}
