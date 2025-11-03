# Voice Assistant Bot

A voice-activated assistant that continuously listens and responds to user commands using speech recognition and text-to-speech technologies.

## Features

### 🎙️ Continuous Listening
- Always listening for wake words
- Automatically restarts recognition after responses
- Robust error handling and recovery

### 🗣️ Natural Responses
- Context-aware response generation
- Multiple response variations for natural conversation
- Supports various conversation topics

### 🎯 Wake Word Detection
The bot responds to these wake words:
- "Hey Bot" / "Hey bot"
- "Hello Bot" / "Hello bot" 
- "Assistant" / "assistant"

### 💬 Conversation Topics
The bot can respond to:

#### Time & Date Queries
- "What time is it?"
- "What's the date today?"

#### Entertainment
- "Tell me a joke"
- "Say something funny"

#### Greetings & Social
- "Hello", "Hi", "Hey"
- Thank you and compliments
- Goodbye and farewells

#### Help & Information
- "What can you do?"
- "Help me"

#### General Conversation
- Default responses for casual conversation
- Encouraging continued interaction

### ⚙️ Customizable Settings
- **Voice Selection**: Choose from multiple English voices
- **Speech Speed**: Adjust from extra slow to extra fast
- **Language**: Multiple English variants (US, UK, Canada, Australia)

### 🎛️ Smart Status Indicators
- **😴 Idle**: Bot is ready to start
- **👂 Listening**: Bot is listening for wake words
- **🤔 Processing**: Bot is thinking about response
- **🗣️ Speaking**: Bot is giving a response

## How to Use

1. **Start the Bot**: Click the "Start Bot" button
2. **Wake Up the Bot**: Say one of the wake words ("Hey Bot", "Hello Bot", or "Assistant")
3. **Give Commands**: Once awake, the bot will respond to your voice commands
4. **Auto Sleep**: Bot goes back to sleep after 30 seconds of inactivity

## Technical Features

### Speech Recognition
- Uses Web Speech API (SpeechRecognition)
- Continuous listening with automatic restart
- Interim and final result processing
- Error handling and recovery

### Text-to-Speech
- Uses Web Speech Synthesis API
- Configurable voice selection
- Adjustable speech rate
- Interruption handling

### Conversation Management
- Real-time conversation display
- User and bot message differentiation
- Auto-scrolling conversation view
- Message timestamps

### State Management
- Bot active/inactive states
- Awake/sleep cycle management
- Speaking/listening coordination
- Status indicator synchronization

## Browser Compatibility

This bot requires a modern browser that supports:
- Web Speech API (Speech Recognition)
- Speech Synthesis API
- ES6+ JavaScript features

**Recommended browsers:**
- Google Chrome (best support)
- Microsoft Edge
- Firefox (limited support)
- Safari (macOS/iOS)

## Privacy

This voice bot:
- Processes speech locally in your browser
- Does not send audio data to external servers
- Does not store conversation history permanently
- Uses only browser-native speech technologies

## Future Enhancements

Potential features for future versions:
- Custom wake word training
- Persistent conversation memory
- Integration with external APIs (weather, news, etc.)
- Voice command macros
- Multi-language support
- Offline speech recognition

## Troubleshooting

### Bot Not Responding
1. Check if microphone permissions are granted
2. Ensure you're using a supported browser
3. Try refreshing the page and restarting the bot
4. Speak clearly and at normal volume

### Speech Recognition Errors
1. Check microphone is working properly
2. Reduce background noise
3. Speak closer to the microphone
4. Try a different browser

### Text-to-Speech Issues
1. Check browser audio settings
2. Ensure system volume is up
3. Try different voice settings
4. Restart the browser if needed

## File Structure

```
voice-bot/
├── index.html          # Main bot interface
├── README.md          # This documentation
└── (future files)     # Additional features coming soon
```

## Getting Started

1. Open `index.html` in a supported web browser
2. Grant microphone permissions when prompted
3. Click "Start Bot" to begin
4. Say "Hey Bot" to wake up the assistant
5. Start conversing with your voice assistant!

Enjoy your new voice assistant bot! 🤖✨