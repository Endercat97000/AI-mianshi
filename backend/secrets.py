"""Windows DPAPI protects secrets for the current OS user; no third party vault."""
import base64
import ctypes
import os
from ctypes import wintypes

PREFIX = "dpapi:"

class Blob(ctypes.Structure):
    _fields_ = [("size", wintypes.DWORD), ("data", ctypes.POINTER(ctypes.c_ubyte))]

def _transform(raw: bytes, decrypt: bool) -> bytes:
    buffer = ctypes.create_string_buffer(raw)
    source = Blob(len(raw), ctypes.cast(buffer, ctypes.POINTER(ctypes.c_ubyte)))
    target = Blob()
    crypt = ctypes.WinDLL("crypt32", use_last_error=True)
    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    function = crypt.CryptUnprotectData if decrypt else crypt.CryptProtectData
    function.argtypes = [ctypes.POINTER(Blob), ctypes.c_void_p, ctypes.c_void_p, ctypes.c_void_p, ctypes.c_void_p, wintypes.DWORD, ctypes.POINTER(Blob)]
    function.restype = wintypes.BOOL
    kernel.LocalFree.argtypes = [ctypes.c_void_p]
    if not function(ctypes.byref(source), None, None, None, None, 1, ctypes.byref(target)):
        raise ValueError("无法访问 Windows 密钥保护，请在设置页重新保存 API Key。")
    try:
        return ctypes.string_at(target.data, target.size)
    finally:
        kernel.LocalFree(target.data)

def protect(value: str) -> str:
    if not value or value.startswith(PREFIX):
        return value
    if os.name != "nt":
        return value
    return PREFIX + base64.b64encode(_transform(value.encode(), False)).decode()

def reveal(value: str) -> str:
    if not value.startswith(PREFIX):
        return value
    if os.name != "nt":
        raise ValueError("密钥由 Windows 保护，请在此设备重新输入。")
    return _transform(base64.b64decode(value[len(PREFIX):]), True).decode()
