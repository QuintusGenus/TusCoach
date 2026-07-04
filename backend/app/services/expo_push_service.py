"""
Expo Push Notification Service

Handles sending push notifications via the Expo Push API.
Docs: https://docs.expo.dev/push-notifications/sending-notifications/
"""
import logging
from typing import List, Dict, Any, Optional
import requests
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.notifications import Notification
from app.models.devices import Device

logger = logging.getLogger(__name__)
settings = get_settings()


def send_expo_push_notification(
    expo_push_tokens: List[str],
    title: str,
    body: str,
    data: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Send a push notification to one or more Expo push tokens.

    Args:
        expo_push_tokens: List of Expo push tokens (e.g., ["ExponentPushToken[xxx]"])
        title: Notification title
        body: Notification body
        data: Optional data payload for deep linking

    Returns:
        Response from Expo Push API with ticket information
    """
    if not expo_push_tokens:
        return {"data": []}

    # Build the push message
    # Expo accepts array of messages
    messages = []
    for token in expo_push_tokens:
        message = {
            "to": token,
            "sound": "default",
            "title": title,
            "body": body,
        }
        if data:
            message["data"] = data
        messages.append(message)

    # Prepare headers
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    # Add access token if provided
    if settings.EXPO_ACCESS_TOKEN:
        headers["Authorization"] = f"Bearer {settings.EXPO_ACCESS_TOKEN}"

    try:
        response = requests.post(
            settings.EXPO_PUSH_URL,
            json=messages,
            headers=headers,
            timeout=10
        )
        response.raise_for_status()
        result = response.json()

        logger.info(f"Sent {len(messages)} push notification(s) to Expo API")
        return result

    except requests.exceptions.RequestException as e:
        logger.error(f"Failed to send push notification: {e}")
        raise


def process_expo_response(
    db: Session,
    notification: Notification,
    expo_tokens: List[str],
    expo_response: Dict[str, Any]
) -> Dict[str, int]:
    """
    Process the response from Expo Push API and update notification status.

    Args:
        db: Database session
        notification: Notification record
        expo_tokens: List of tokens that were sent to
        expo_response: Response from Expo API

    Returns:
        Dictionary with counts: {"success": int, "failed": int, "device_errors": int}
    """
    stats = {"success": 0, "failed": 0, "device_errors": 0}

    # Expo returns {"data": [{"status": "ok", "id": "..."}, {"status": "error", "message": "...", "details": {...}}]}
    tickets = expo_response.get("data", [])

    errors = []
    for idx, ticket in enumerate(tickets):
        status = ticket.get("status")

        if status == "ok":
            stats["success"] += 1
        elif status == "error":
            stats["failed"] += 1
            error_message = ticket.get("message", "Unknown error")
            error_details = ticket.get("details", {})

            # Log the error
            errors.append(f"Token {idx}: {error_message}")

            # Handle DeviceNotRegistered error - remove the device
            error_code = error_details.get("error")
            if error_code == "DeviceNotRegistered" and idx < len(expo_tokens):
                token = expo_tokens[idx]
                device = db.query(Device).filter(Device.expo_push_token == token).first()
                if device:
                    logger.warning(f"Removing invalid device token: {token} (DeviceNotRegistered)")
                    db.delete(device)
                    stats["device_errors"] += 1

    # Update notification status based on results
    # Mark as "sent" if at least one device succeeded
    # Mark as "failed" only if ALL devices failed
    if stats["success"] > 0:
        # At least one device received the notification successfully
        from datetime import datetime
        from app.services.notification_service import mark_notification_sent
        mark_notification_sent(db, notification.id)
    else:
        # All devices failed (or no devices)
        from app.services.notification_service import mark_notification_failed
        if errors:
            # Truncate error message to avoid DB overflow
            error_summary = "; ".join(errors)[:500]
        else:
            error_summary = "All devices failed"
        mark_notification_failed(db, notification.id, error_summary)

    db.commit()

    logger.info(
        f"Notification {notification.id}: {stats['success']} sent, "
        f"{stats['failed']} failed, {stats['device_errors']} device errors"
    )

    return stats
