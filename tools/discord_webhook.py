"""
@file        discord_webhook.py
@author      Wildflover
@description Discord Webhook Tool - Professional embed with button-style links
@language    Python 3.11+
@module      Discord API Integration
"""

import requests
import json
import os
from dataclasses import dataclass
from typing import Optional, List
from colorama import init, Fore, Style

# Initialize colorama for Windows CMD support
init(autoreset=True)


# [CONFIG] Webhook and download settings
# IMPORTANT: Replace with your own Discord webhook URL
# Create at: Discord Server Settings > Integrations > Webhooks
WEBHOOK_URL = "YOUR_DISCORD_WEBHOOK_URL"

# [CONFIG] Direct download URL - Starts download immediately
DIRECT_DOWNLOAD_URL = "YOUR_DIRECT_DOWNLOAD_URL"

# [CONFIG] Download page URLs
MEDIAFIRE_URL = "YOUR_MEDIAFIRE_URL"
GOOGLE_DRIVE_URL = "YOUR_GOOGLE_DRIVE_URL"
DROPBOX_URL = "YOUR_DROPBOX_URL"

# [CONFIG] Banner paths
BANNER_URL = "https://i.ibb.co/vxLHqjyM/download-banner.png"
BANNER_LOCAL_PATH = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets', 'discord', 'download_banner.png')


@dataclass
class EmbedField:
    """Embed field structure"""
    name: str
    value: str
    inline: bool = True


class DiscordWebhook:
    """
    Professional Discord Webhook Handler
    Supports rich embeds with banner, description, fields and link buttons
    """
    
    # Wildflover color palette
    COLOR_PINK = 0xC94B7C
    COLOR_DARK = 0x1A1A2E
    COLOR_CYAN = 0x00D4FF
    
    def __init__(self, webhook_url: str):
        self.webhook_url = webhook_url
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def _log(self, tag: str, message: str, color: str = Fore.WHITE) -> None:
        """Professional logging output"""
        print(f"{Fore.CYAN}[{tag}]{Style.RESET_ALL} {color}{message}{Style.RESET_ALL}")
    
    def send_install_message(
        self,
        banner_url: str,
        direct_url: str,
        mediafire_url: str,
        gdrive_url: str,
        dropbox_url: str,
        title: str = "Wildflover",
        description: str = "League of Legends Skin Manager"
    ) -> bool:
        """
        Send professional install message with banner and quad download buttons
        Directly (first), MediaFire, Google Drive, Dropbox - side by side layout
        
        Args:
            banner_url: CDN URL for banner image
            direct_url: Direct download link (starts download immediately)
            mediafire_url: MediaFire page link
            gdrive_url: Google Drive page link
            dropbox_url: Dropbox page link
            title: Embed title
            description: Short description
        
        Returns:
            bool: Success status
        """
        
        # Single embed with inline fields - 2x2 grid layout
        main_embed = {
            "color": self.COLOR_PINK,
            "title": "UPDATE 0.0.3",
            "description": "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
            "fields": [
                {
                    "name": "Directly",
                    "value": f"**[Click to Install]({direct_url})**",
                    "inline": True
                },
                {
                    "name": "MediaFire",
                    "value": f"**[Click to Install]({mediafire_url})**",
                    "inline": True
                },
                {
                    "name": "Google Drive",
                    "value": f"**[Click to Install]({gdrive_url})**",
                    "inline": True
                },
                {
                    "name": "Dropbox",
                    "value": f"**[Click to Install]({dropbox_url})**",
                    "inline": True
                }
            ],
            "image": {"url": banner_url},
            "footer": {
                "text": "Wildflover › Windows 10/11"
            }
        }
        
        payload = {
            "username": "Wildflover",
            "embeds": [main_embed]
        }
        
        return self._send(payload)
    
    def send_minimal_install(self, banner_url: str, direct_url: str, mediafire_url: str, gdrive_url: str, dropbox_url: str) -> bool:
        """
        Send minimal install message - banner with quad download buttons
        
        Args:
            banner_url: Banner image URL
            direct_url: Direct download link
            mediafire_url: MediaFire page link
            gdrive_url: Google Drive page link
            dropbox_url: Dropbox page link
        
        Returns:
            bool: Success status
        """
        
        embed = {
            "color": self.COLOR_PINK,
            "title": "UPDATE 0.0.3",
            "description": "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
            "fields": [
                {
                    "name": "Directly",
                    "value": f"**[Click to Install]({direct_url})**",
                    "inline": True
                },
                {
                    "name": "MediaFire",
                    "value": f"**[Click to Install]({mediafire_url})**",
                    "inline": True
                },
                {
                    "name": "Google Drive",
                    "value": f"**[Click to Install]({gdrive_url})**",
                    "inline": True
                },
                {
                    "name": "Dropbox",
                    "value": f"**[Click to Install]({dropbox_url})**",
                    "inline": True
                }
            ],
            "image": {"url": banner_url},
            "footer": {"text": "Wildflover • Windows 10/11"}
        }
        
        payload = {
            "username": "Wildflover",
            "embeds": [embed]
        }
        
        return self._send(payload)
    
    def send_banner_text_only(self, direct_url: str, mediafire_url: str, gdrive_url: str, dropbox_url: str) -> bool:
        """
        Send banner text content as Discord embed (no image)
        Displays quad download buttons with feature list
        
        Args:
            direct_url: Direct download link
            mediafire_url: MediaFire page link
            gdrive_url: Google Drive page link
            dropbox_url: Dropbox page link
        
        Returns:
            bool: Success status
        """
        
        embed = {
            "color": self.COLOR_PINK,
            "title": "Wildflover",
            "description": (
                "*League of Legends Skin Manager*\n"
                "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
                "`Wildflover` `Windows 10/11`\n\n"
                "› **All Skins Unlocked** / Tüm Skinler Açık\n"
                "› **Safe & Undetectable** / Güvenli & Tespit Edilemez\n"
                "› **Auto Updates** / Otomatik Güncellemeler\n\n"
                "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            ),
            "fields": [
                {
                    "name": "Directly",
                    "value": f"**[Click to Install]({direct_url})**",
                    "inline": True
                },
                {
                    "name": "MediaFire",
                    "value": f"**[Click to Install]({mediafire_url})**",
                    "inline": True
                },
                {
                    "name": "Google Drive",
                    "value": f"**[Click to Install]({gdrive_url})**",
                    "inline": True
                },
                {
                    "name": "Dropbox",
                    "value": f"**[Click to Install]({dropbox_url})**",
                    "inline": True
                }
            ],
            "footer": {
                "text": "Wildflover › Windows 10/11"
            }
        }
        
        payload = {
            "username": "Wildflover",
            "embeds": [embed]
        }
        
        return self._send(payload)
    
    def send_runeforge_style(self, banner_url: str, direct_url: str, mediafire_url: str, gdrive_url: str, dropbox_url: str) -> bool:
        """
        Send clean embed with large banner and quad INSTALL buttons
        
        Args:
            banner_url: Banner image URL (1200x400)
            direct_url: Direct download link
            mediafire_url: MediaFire page link
            gdrive_url: Google Drive page link
            dropbox_url: Dropbox page link
        
        Returns:
            bool: Success status
        """
        
        embed = {
            "color": self.COLOR_PINK,
            "title": "UPDATE 0.0.3",
            "description": "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
            "fields": [
                {
                    "name": "Directly",
                    "value": f"**[Click to Install]({direct_url})**",
                    "inline": True
                },
                {
                    "name": "MediaFire",
                    "value": f"**[Click to Install]({mediafire_url})**",
                    "inline": True
                },
                {
                    "name": "Google Drive",
                    "value": f"**[Click to Install]({gdrive_url})**",
                    "inline": True
                },
                {
                    "name": "Dropbox",
                    "value": f"**[Click to Install]({dropbox_url})**",
                    "inline": True
                }
            ],
            "image": {"url": banner_url},
            "footer": {
                "text": "Wildflover › Windows 10/11"
            }
        }
        
        payload = {
            "username": "Wildflover",
            "embeds": [embed]
        }
        
        return self._send(payload)
    
    def send_attachment_style(self, banner_path: str, direct_url: str, mediafire_url: str, gdrive_url: str, dropbox_url: str) -> bool:
        """
        Send banner as standalone file attachment with quad download links
        Discord shows raw attachments at full resolution
        
        Args:
            banner_path: Local path to banner image
            direct_url: Direct download link
            mediafire_url: MediaFire page link
            gdrive_url: Google Drive page link
            dropbox_url: Dropbox page link
        
        Returns:
            bool: Success status
        """
        
        if not os.path.exists(banner_path):
            self._log("WEBHOOK-ERROR", f"Banner not found: {banner_path}", Fore.RED)
            return False
        
        payload = {
            "username": "Wildflover",
            "content": (
                f"**Directly** [Click to Install]({direct_url}) | "
                f"**MediaFire** [Click to Install]({mediafire_url})\n"
                f"**Google Drive** [Click to Install]({gdrive_url}) | "
                f"**Dropbox** [Click to Install]({dropbox_url})\n"
                f"`Wildflover › Windows 10/11`"
            )
        }
        
        return self._send_with_file(payload, banner_path)
    
    def _send_with_file(self, payload: dict, file_path: str) -> bool:
        """Send webhook payload with file attachment"""
        try:
            self._log("WEBHOOK-SEND", "Sending message with attachment...", Fore.YELLOW)
            
            with open(file_path, 'rb') as f:
                files = {
                    'file': ('download_banner.png', f, 'image/png')
                }
                
                # Multipart form data - payload_json for embed data
                response = requests.post(
                    self.webhook_url,
                    data={'payload_json': json.dumps(payload)},
                    files=files
                )
            
            if response.status_code in [200, 204]:
                self._log("WEBHOOK-SUCCESS", "Message with attachment delivered", Fore.GREEN)
                return True
            else:
                self._log("WEBHOOK-ERROR", f"Status {response.status_code}", Fore.RED)
                self._log("WEBHOOK-RESPONSE", response.text, Fore.RED)
                return False
                
        except requests.RequestException as e:
            self._log("WEBHOOK-EXCEPTION", str(e), Fore.RED)
            return False
    
    def _send(self, payload: dict) -> bool:
        """Send webhook payload to Discord"""
        try:
            self._log("WEBHOOK-SEND", "Sending message to Discord...", Fore.YELLOW)
            
            response = self.session.post(
                self.webhook_url,
                data=json.dumps(payload)
            )
            
            if response.status_code == 204:
                self._log("WEBHOOK-SUCCESS", "Message delivered successfully", Fore.GREEN)
                return True
            else:
                self._log("WEBHOOK-ERROR", f"Status {response.status_code}", Fore.RED)
                self._log("WEBHOOK-RESPONSE", response.text, Fore.RED)
                return False
                
        except requests.RequestException as e:
            self._log("WEBHOOK-EXCEPTION", str(e), Fore.RED)
            return False


def print_banner() -> None:
    """Display startup banner"""
    print(f"""
{Fore.MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{Fore.WHITE}  WILDFLOVER DISCORD WEBHOOK TOOL
{Fore.MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{Fore.CYAN}  Author      {Fore.WHITE}: Wildflover
{Fore.CYAN}  Module      {Fore.WHITE}: Discord Webhook Integration
{Fore.CYAN}  Features    {Fore.WHITE}: Rich Embeds, Banner Support, Link Buttons
{Fore.MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{Style.RESET_ALL}""")


def main():
    """Main entry point"""
    print_banner()
    
    webhook = DiscordWebhook(WEBHOOK_URL)
    
    print(f"{Fore.CYAN}[CONFIG]{Style.RESET_ALL} Webhook configured")
    print(f"{Fore.CYAN}[CONFIG]{Style.RESET_ALL} Direct URL: {DIRECT_DOWNLOAD_URL[:50]}...")
    print(f"{Fore.CYAN}[CONFIG]{Style.RESET_ALL} MediaFire URL: {MEDIAFIRE_URL[:50]}...")
    print(f"{Fore.CYAN}[CONFIG]{Style.RESET_ALL} Google Drive URL: {GOOGLE_DRIVE_URL[:50]}...")
    print(f"{Fore.CYAN}[CONFIG]{Style.RESET_ALL} Dropbox URL: {DROPBOX_URL[:50]}...")
    print()
    
    # Message style selection
    print(f"{Fore.MAGENTA}[SELECT]{Style.RESET_ALL} Choose message style:")
    print(f"  {Fore.WHITE}1{Style.RESET_ALL} - Quad Buttons + Banner (Full)")
    print(f"  {Fore.WHITE}2{Style.RESET_ALL} - Text Only with Links (No Image)")
    print(f"  {Fore.WHITE}3{Style.RESET_ALL} - Minimal Quad Buttons")
    print(f"  {Fore.WHITE}4{Style.RESET_ALL} - RuneForge Style")
    print(f"  {Fore.WHITE}5{Style.RESET_ALL} - Attachment Style (Local File)")
    print()
    
    choice = input(f"{Fore.CYAN}[INPUT]{Style.RESET_ALL} Enter choice (1-5): ").strip()
    print()
    
    if choice == "1":
        # Full - Quad buttons + Banner
        if not BANNER_URL:
            print(f"{Fore.YELLOW}[WARNING]{Style.RESET_ALL} BANNER_URL is empty!")
            return
        webhook.send_install_message(BANNER_URL, DIRECT_DOWNLOAD_URL, MEDIAFIRE_URL, GOOGLE_DRIVE_URL, DROPBOX_URL)
        
    elif choice == "2":
        # Text only with quad links
        webhook.send_banner_text_only(DIRECT_DOWNLOAD_URL, MEDIAFIRE_URL, GOOGLE_DRIVE_URL, DROPBOX_URL)
        
    elif choice == "3":
        # Minimal - Quad buttons with banner
        if not BANNER_URL:
            print(f"{Fore.YELLOW}[WARNING]{Style.RESET_ALL} BANNER_URL is empty!")
            return
        webhook.send_minimal_install(BANNER_URL, DIRECT_DOWNLOAD_URL, MEDIAFIRE_URL, GOOGLE_DRIVE_URL, DROPBOX_URL)
        
    elif choice == "4":
        # RuneForge style - Quad buttons with banner
        if not BANNER_URL:
            print(f"{Fore.YELLOW}[WARNING]{Style.RESET_ALL} BANNER_URL is empty!")
            return
        webhook.send_runeforge_style(BANNER_URL, DIRECT_DOWNLOAD_URL, MEDIAFIRE_URL, GOOGLE_DRIVE_URL, DROPBOX_URL)
        
    elif choice == "5":
        # Attachment style - Full resolution banner as file upload
        webhook.send_attachment_style(BANNER_LOCAL_PATH, DIRECT_DOWNLOAD_URL, MEDIAFIRE_URL, GOOGLE_DRIVE_URL, DROPBOX_URL)
        
    else:
        print(f"{Fore.RED}[ERROR]{Style.RESET_ALL} Invalid choice")


if __name__ == "__main__":
    main()
