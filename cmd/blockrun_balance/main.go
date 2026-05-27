package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"os"
	"strings"

	ethcrypto "github.com/ethereum/go-ethereum/crypto"
)

const (
	usdcContractBase = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"
	baseRPC          = "https://mainnet.base.org"
	// balanceOf(address) selector
	balanceOfSelector = "0x70a08231"
)

type rpcReq struct {
	JSONRPC string        `json:"jsonrpc"`
	ID      int           `json:"id"`
	Method  string        `json:"method"`
	Params  []interface{} `json:"params"`
}

type rpcResp struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      int             `json:"id"`
	Result  string          `json:"result"`
	Error   *struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
	} `json:"error"`
}

func main() {
	if len(os.Args) < 2 {
		fmt.Fprintln(os.Stderr, "usage: blockrun_balance <privateKeyHex>")
		os.Exit(2)
	}
	pkHex := strings.TrimPrefix(strings.TrimSpace(os.Args[1]), "0x")
	if len(pkHex) != 64 {
		fmt.Fprintf(os.Stderr, "private key must be 64 hex chars (got %d)\n", len(pkHex))
		os.Exit(2)
	}
	pk, err := ethcrypto.HexToECDSA(pkHex)
	if err != nil {
		fmt.Fprintf(os.Stderr, "invalid secp256k1 hex: %v\n", err)
		os.Exit(2)
	}
	addr := ethcrypto.PubkeyToAddress(pk.PublicKey)
	addrHex := strings.ToLower(addr.Hex())
	fmt.Printf("Derived EVM address: %s\n", addr.Hex())

	// Query native ETH balance on Base
	ethBalRaw, err := rpcCall(baseRPC, "eth_getBalance", []interface{}{addrHex, "latest"})
	if err != nil {
		fmt.Fprintf(os.Stderr, "eth_getBalance error: %v\n", err)
	} else {
		ethBal := hexToBigInt(ethBalRaw)
		fmt.Printf("Base ETH balance (wei): %s\n", ethBal.String())
		fmt.Printf("Base ETH balance (ETH): %s\n", formatUnits(ethBal, 18))
	}

	// Query USDC balance via eth_call
	// Pack: selector + 32-byte address (left-padded)
	addrNoPrefix := strings.TrimPrefix(addrHex, "0x")
	data := balanceOfSelector + strings.Repeat("0", 64-len(addrNoPrefix)) + addrNoPrefix
	callObj := map[string]interface{}{
		"to":   usdcContractBase,
		"data": data,
	}
	usdcRaw, err := rpcCall(baseRPC, "eth_call", []interface{}{callObj, "latest"})
	if err != nil {
		fmt.Fprintf(os.Stderr, "eth_call USDC balanceOf error: %v\n", err)
		os.Exit(1)
	}
	usdcBal := hexToBigInt(usdcRaw)
	fmt.Printf("USDC (Base) balance (atomic, 6 decimals): %s\n", usdcBal.String())
	fmt.Printf("USDC (Base) balance (USDC): %s\n", formatUnits(usdcBal, 6))
}

func rpcCall(url, method string, params []interface{}) (string, error) {
	reqBody, _ := json.Marshal(rpcReq{JSONRPC: "2.0", ID: 1, Method: method, Params: params})
	req, _ := http.NewRequest("POST", url, bytes.NewReader(reqBody))
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	var r rpcResp
	if err := json.Unmarshal(body, &r); err != nil {
		return "", fmt.Errorf("decode: %w, body=%s", err, string(body))
	}
	if r.Error != nil {
		return "", fmt.Errorf("rpc error %d: %s", r.Error.Code, r.Error.Message)
	}
	return r.Result, nil
}

func hexToBigInt(h string) *big.Int {
	h = strings.TrimPrefix(h, "0x")
	if h == "" {
		return big.NewInt(0)
	}
	n, ok := new(big.Int).SetString(h, 16)
	if !ok {
		return big.NewInt(0)
	}
	return n
}

func formatUnits(n *big.Int, decimals int) string {
	s := n.String()
	if len(s) <= decimals {
		s = strings.Repeat("0", decimals-len(s)+1) + s
	}
	intPart := s[:len(s)-decimals]
	fracPart := s[len(s)-decimals:]
	fracPart = strings.TrimRight(fracPart, "0")
	if fracPart == "" {
		return intPart
	}
	return intPart + "." + fracPart
}
