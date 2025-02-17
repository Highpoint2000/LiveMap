# Live Map for [FM-DX-Webserver](https://github.com/NoobishSVK/fm-dx-webserver)

This plugin displays the detected and neighboring broadcast stations in real time on a map and table..

![image](https://github.com/user-attachments/assets/bbfe6e17-8ea9-4a9b-8df4-12b3ecf72fad)


## Version 2.6 (only works from web server version 1.3.5!!!)

- Design adjustments for web server version 1.3.5

  
## Installation notes:

1. 	Download the last repository as a zip
2.	Unpack the LiveMapPlugin.js and the LiveMap folder with the livemap.js into the web server plugins folder (..fm-dx-webserver-main\plugins)
3. 	Restart the server
4. 	Activate the plugin it in the settings
5.	Read the LiveMapQuickGuide.pdf

## Configuration options:

The following variables can be changed in the header of the script:

    ConsoleDebug = false;        // Activate/Deactivate console output	
    FMLIST_OM_ID = '';           // If you want to use the logbook function, enter your OM ID here, e.g., FMLIST_OM_ID = '1234'
    PSTRotatorFunctions = false; // If you use the PSTRotator plugin, you can activate the control here (default = false)
    const updateInfo = true;     // Enable or disable version check

## Important notes: 

- In order to display the position correctly, your own coordinates must be entered in the web server!
- An initial display occurs as soon as a first PI code has been recognized. The display is further specified upon receipt of a station ID and updated dynamically as changes occur.
- The position of the pop-up window can be changed by pressing the edge and moving the window. You can resize the window by pressing and dragging the blue square in the bottom right corner.
- The frequency table can be shown and hidden using the red square.
- Clicking on the green player symbol opens the link to the live stream (FMSCAN login required).
- Clicking on the location shows all programs at the location, clicking again returns. The frequency displayed in the location list can be clicked directly.
- To move the web server horizontally, press and hold the LiveMap button and drag and drop!
- Click on the web server's frequency display to quickly jump to the previous frequency or toggle between two frequencies, press and hold the left mouse button to deactivate/activate the display
- For authenticated station: Click TX Location to directly open the fmscan.org website with more information (FMSCAN login required)
- To use the FMLIST logbook direct link feature, please enter your OMID in the header of the script!
- If the PSTRotator function is activated in the header, you can rotate the rotor in that direction by clicking on the station name
- When GPS data is received, the location is updated dynamically (GPS receiver and [GPS plugin](https://github.com/Highpoint2000/GPS) required!)
  
## History:

### v2.5

- Daily update check for admin
- Dynamic location determination with GPS (GPS Receiver & [GPS plugin](https://github.com/Highpoint2000/GPS) required!)

### v2.4

- Fixed sending the frequency multiple times
- Rotor control for [PSTRotator plugin](https://github.com/Highpoint2000/PSTRotator) integrated

### v2.3

- Minor design adjustments
- Added a direct link for an entry in the FMLIST logbook (enter your OMID in the header of the script!)


### v2.2a

- For authenticated station: direct link on TX Location open fmscan.org website (FMSCAN login required)


### v2.2

- Integrated filter for programs without station name

### v2.1f

- Once the transmitter has been identified, all other programs and frequencies for the location are displayed

### v2.1e

- activate/deactivate frequency toggling (pressing the frequency display for a longer time!)
- location list is sorted by ERP
- first load values been adjusted

### v2.1d

- Quickly jump to the previous frequency or toggle between two frequencies (click on the web server's frequency display)
- Moving the map and table is limited to screen limits

### v2.1c

- Adjustments for displaying stations without PI code
- Caching function revised

### v2.1b

- Implemented horizontal drag and drop movement of the web server (keep the LiveMap button pressed!)

### v2.1a

- Design adjustments
- Implemented the ability to automatically move the web server GUI to the right

### v2.1

- Design adjustments
- Added polarization to the frequency table
- link to the livestream player
- Frequency list can be hidden (red square)
- Clicking on the city displays all stations in the location
- direct selection of the frequency for the FM-DX web server

### v2.0

- new layout
- Display of transmitters if no PI code is received
- Filter for distances (100, 250, 500, 750, 1000 km)
- TXPOS button for radius display around the transmitter position (details see LiveMapQuickGuide.pdf!)
- Implemented PI code verification

### v1.2a

- Insert close X at the top-right corner

### v1.2

- Enlarged header with additional log information

### v1.1

- The position and size of the window is now variable
- Problems with using the web server button have been fixed

### v1.0

- first edition
