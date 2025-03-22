# BuddyWay - Real-Time Location Sharing

BuddyWay is a real-time location sharing web application that allows users to create sessions, share their locations, and navigate to each other's positions.

## Features

- **Real-Time Location Sharing**: Share your live location with session members
- **Interactive Map Interface**: Built with Leaflet.js for smooth map interactions
- **Session Management**: Create and join sessions with unique codes
- **Navigation Support**: Get directions to other members' locations
- **Common Destination**: Hosts can set a common destination for all members
- **Auto-Reconnect**: Automatically reconnects if connection is lost
- **Mobile-Friendly**: Responsive design works well on all devices

## Technology Stack

- **Frontend**:
  - Leaflet.js for map functionality
  - Socket.IO for real-time communication
  - EJS for templating

- **Backend**:
  - Node.js with Express.js
  - Socket.IO server for real-time updates

## Setup Instructions

1. Clone the repository:
   ```bash
   git clone https://github.com/itzfarzaan/BuddyWay.git
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```

4. Access the application at `http://localhost:8002`

## Usage

1. **Create a Session**:
   - Click "Create Session"
   - Share the session code with others

2. **Join a Session**:
   - Enter the session code provided by the host
   - Choose a display name

3. **Use the Map**:
   - View real-time locations of session members
   - Click on a member to get directions
   - Use the navigation panel to set start/end points

4. **Host Features**:
   - Set a common destination for all members
   - End the session when done

## Note for Future Development
- Navigation route for a user flickers a lot because of the frequent marker update of the user
- UI changes required - specially for mobile devices

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a pull request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.