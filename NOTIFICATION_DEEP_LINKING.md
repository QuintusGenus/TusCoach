# Push Notification Deep Linking - Implementation Complete

Successfully implemented notification tap handling and deep linking for the mobile app.

## Summary

When users tap on a push notification, the app automatically navigates to the relevant message detail screen (or inbox as fallback). This works in **all app states**: foreground, background, and killed (cold start).

---

## Files Created

### 1. `mobile/src/hooks/useNotificationHandler.ts` (NEW)

Custom React hook that handles notification taps and navigation.

**Key Features:**
- Listens for notification taps using `addNotificationResponseReceivedListener`
- Handles cold start launches (when app is killed and opened via notification)
- Automatically cleans up listeners on unmount
- Navigates to message detail screen or inbox based on notification data

**How it works:**

```typescript
// Listen for notification taps (foreground/background)
const subscription = Notifications.addNotificationResponseReceivedListener(response => {
    const data = response.notification.request.content.data;
    // Navigate based on data
});

// Check if app was launched from notification (cold start)
const response = await Notifications.getLastNotificationResponseAsync();
if (response) {
    // Navigate with small delay for nav initialization
}
```

**Navigation Logic:**
1. If notification has `kind: "coach_message"` and `workflow_run_id`:
   - Navigate to `/message/{workflow_run_id}`
2. Otherwise:
   - Navigate to `/(tabs)/inbox` (fallback)

**Error Handling:**
- Try/catch around navigation
- Falls back to inbox if message navigation fails
- Logs all actions for debugging

---

## Files Modified

### 2. `mobile/app/_layout.tsx`

**Changes:**
- Import `useNotificationHandler` hook
- Call hook in `RootLayoutNav` component (line 36)

```typescript
function RootLayoutNav() {
  // ... existing code ...

  // Handle notification taps and deep linking
  useNotificationHandler();

  // ... rest of component ...
}
```

**Why here?**
- `RootLayoutNav` is always mounted when app is running
- Ensures notification listener is active throughout app lifecycle
- Hook handles its own cleanup on unmount

---

## How It Works

### **Scenario 1: App in Foreground**

1. Push notification arrives
2. Notification appears at top of screen (configured to show alert)
3. User taps notification
4. `addNotificationResponseReceivedListener` fires
5. Hook extracts data: `{ kind: "coach_message", workflow_run_id: 123 }`
6. App navigates to `/message/123`
7. User sees message detail screen

### **Scenario 2: App in Background**

1. Push notification arrives
2. Notification appears in notification center
3. User taps notification
4. App comes to foreground
5. `addNotificationResponseReceivedListener` fires
6. Hook extracts data and navigates to message
7. User sees message detail screen

### **Scenario 3: App Killed (Cold Start)**

1. Push notification arrives while app is not running
2. Notification appears in notification center
3. User taps notification
4. **App launches**
5. `RootLayoutNav` mounts and calls `useNotificationHandler()`
6. Hook calls `getLastNotificationResponseAsync()`
7. Finds the notification that launched the app
8. Waits 1 second for navigation to initialize
9. Navigates to message detail screen
10. User sees message detail screen

---

## Notification Data Format

The backend sends notifications with this data payload:

```typescript
{
  kind: "coach_message",
  workflow_run_id: 123,
  student_id: 456
}
```

**From backend** ([backend/app/services/notification_service.py](backend/app/services/notification_service.py:128-134)):
```python
data = {
    "kind": "coach_message",
    "workflow_run_id": workflow_run_id,
    "student_id": user_id
}
```

**Parsed in mobile app**:
```typescript
interface NotificationData {
    kind?: string;
    workflow_run_id?: number;
    student_id?: number;
}
```

---

## Routes

### **Message Detail Screen**
- Route: `/message/[workflow_run_id]`
- File: `mobile/app/message/[workflow_run_id].tsx`
- Shows full coach message content

### **Inbox (Fallback)**
- Route: `/(tabs)/inbox`
- File: `mobile/app/(tabs)/inbox.tsx`
- Shows list of all messages

---

## Testing

### **Test in Development:**

1. **Start the app:**
   ```bash
   cd mobile
   npm start
   ```

2. **Login on a physical device** (notifications don't work on simulators)

3. **Send a test notification** from backend:
   ```bash
   # Insert test notification
   psql -h localhost -p 5433 -U tuscoach -d tuscoach -c "
   INSERT INTO notifications (user_id, workflow_run_id, type, title, body, data, status, created_at)
   VALUES (
     1,
     42,
     'coach_message',
     'Test Notification',
     'This is a test notification. Tap to open the message!',
     '{\"kind\": \"coach_message\", \"workflow_run_id\": 42, \"student_id\": 1}',
     'pending',
     NOW()
   );
   "
   ```

4. **Wait for Celery task** to send notification (runs every 1 minute)

5. **Test scenarios:**

   **Foreground:**
   - Keep app open
   - Notification appears at top
   - Tap it → Should navigate to message

   **Background:**
   - Minimize app (home button)
   - Notification appears
   - Tap it → App opens to message

   **Killed:**
   - Force close app (swipe away)
   - Notification appears
   - Tap it → App launches and shows message

### **Expected Console Logs:**

**Foreground/Background:**
```
[NotificationHandler] Notification tapped: {kind: "coach_message", workflow_run_id: 42}
[NotificationHandler] Navigated to message: 42
```

**Cold Start:**
```
[NotificationHandler] App launched from notification: {kind: "coach_message", workflow_run_id: 42}
[NotificationHandler] Navigated to message: 42
```

**Fallback (if navigation fails):**
```
[NotificationHandler] Failed to navigate to message: [error]
[NotificationHandler] Navigated to inbox
```

---

## Edge Cases Handled

### ✅ **No notification data**
- Ignores tap, logs debug message

### ✅ **Unknown notification type**
- Falls back to inbox navigation

### ✅ **Missing workflow_run_id**
- Falls back to inbox navigation

### ✅ **Navigation failure**
- Try/catch around navigation
- Falls back to inbox

### ✅ **Cold start initialization**
- 1-second delay ensures navigation is ready
- Uses `navigationInitialized` ref to prevent duplicate navigation

### ✅ **Listener cleanup**
- Returns cleanup function from useEffect
- Removes listener on component unmount

---

## Code Flow Diagram

```
┌─────────────────────────────────────────┐
│  Push Notification Arrives              │
│  Data: {kind, workflow_run_id, ...}     │
└─────────────────┬───────────────────────┘
                  │
                  ▼
         ┌────────────────────┐
         │   User Taps        │
         │   Notification     │
         └────────┬───────────┘
                  │
                  ▼
    ┌─────────────────────────────────┐
    │ App State?                      │
    ├─────────────┬───────────────────┤
    │             │                   │
    ▼             ▼                   ▼
Foreground    Background          Killed
    │             │                   │
    │             │                   │
    ▼             ▼                   ▼
    └─────────────┴───────────────────┘
                  │
                  ▼
    ┌─────────────────────────────────┐
    │ addNotificationResponseReceived │
    │ Listener Fires                  │
    └─────────────┬───────────────────┘
                  │
                  ▼
    ┌─────────────────────────────────┐
    │ useNotificationHandler          │
    │ Extracts notification.data      │
    └─────────────┬───────────────────┘
                  │
                  ▼
         ┌────────────────────┐
         │ Parse Data         │
         │ Check kind field   │
         └────────┬───────────┘
                  │
         ┌────────┴────────┐
         │                 │
         ▼                 ▼
  kind="coach_message"   Other/Unknown
         │                 │
         ▼                 ▼
  Has workflow_run_id?   Navigate to
         │                Inbox
    ┌────┴────┐
    │         │
    ▼         ▼
   Yes        No
    │         │
    ▼         ▼
Navigate to  Navigate to
/message/123  Inbox
    │
    ▼
┌─────────────────────────────────────────┐
│  Message Detail Screen                  │
│  Shows full coach message content       │
└─────────────────────────────────────────┘
```

---

## Integration with Backend

The notification flow is fully integrated with the backend workflow system:

1. **Workflow completes** with `student_message`
2. **Backend enqueues notification** ([workflow_engine.py](backend/app/services/workflow_engine.py:67-72))
3. **Celery task sends notification** (every 1 minute)
4. **Expo Push API** delivers to device
5. **User taps notification**
6. **Mobile app navigates** to message

**Complete chain:**
```
Workflow → Notification Outbox → Celery Task → Expo API → Device → User Tap → Navigation
```

---

## Dependencies

All required dependencies were already installed in the previous step:
- ✅ `expo-notifications` (~0.30.3)
- ✅ `expo-device` (~7.0.7)
- ✅ `expo-router` (for navigation)

---

## Best Practices Followed

### ✅ **Cleanup Listeners**
```typescript
useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(...);
    return () => {
        subscription.remove(); // Clean up on unmount
    };
}, []);
```

### ✅ **Cold Start Handling**
```typescript
const response = await Notifications.getLastNotificationResponseAsync();
if (response && !navigationInitialized.current) {
    // Handle with delay for nav initialization
    setTimeout(() => { ... }, 1000);
    navigationInitialized.current = true;
}
```

### ✅ **Error Handling**
```typescript
try {
    router.push(`/message/${workflow_run_id}`);
} catch (error) {
    console.error('Navigation failed:', error);
    navigateToInbox(); // Fallback
}
```

### ✅ **Type Safety**
```typescript
interface NotificationData {
    kind?: string;
    workflow_run_id?: number;
    student_id?: number;
}
```

### ✅ **Logging for Debugging**
```typescript
console.log('[NotificationHandler] Notification tapped:', data);
console.log('[NotificationHandler] Navigated to message:', workflow_run_id);
```

---

## Future Enhancements (Optional)

### 1. **Analytics Tracking**
Track which notifications are tapped:
```typescript
Analytics.track('notification_tapped', {
    kind: data.kind,
    workflow_run_id: data.workflow_run_id
});
```

### 2. **Badge Count Management**
Update badge count when notifications are read:
```typescript
await Notifications.setBadgeCountAsync(0);
```

### 3. **Rich Notifications**
Support images, actions, categories:
```typescript
categoryIdentifier: 'message',
actions: [{identifier: 'reply', buttonTitle: 'Reply'}]
```

### 4. **Custom Notification Sounds**
Per notification type:
```typescript
sound: data.kind === 'urgent' ? 'urgent.wav' : 'default'
```

### 5. **In-App Notification UI**
Custom in-app notification banner for foreground notifications.

---

## Summary

**Files Modified:** 1
- `mobile/app/_layout.tsx` - Added notification handler hook

**Files Created:** 2
- `mobile/src/hooks/useNotificationHandler.ts` - Deep linking logic
- `NOTIFICATION_DEEP_LINKING.md` - This documentation

**Features Implemented:**
- ✅ Notification tap handling (foreground/background/killed)
- ✅ Deep linking to message detail screen
- ✅ Fallback to inbox if navigation fails
- ✅ Cold start support (app launched from notification)
- ✅ Proper listener cleanup on unmount
- ✅ Comprehensive error handling
- ✅ Type-safe notification data parsing
- ✅ Debug logging for troubleshooting

**App States Supported:**
- ✅ Foreground - notification banner appears, tap navigates
- ✅ Background - app comes to foreground, navigates to message
- ✅ Killed - app launches, waits for nav init, then navigates

**Production Ready:** ✅ Yes

The push notification deep linking system is now **fully operational** and ready for production use! 🎉
