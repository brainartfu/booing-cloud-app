import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {NavigationContainer, useNavigation, createNavigationContainerRef } from '@react-navigation/native';
import React, {useEffect} from 'react';
import {Image, View, Linking, NativeEventEmitter, NativeModules} from 'react-native';
import {
  Account,
  Apks,
  ClearData,
  Dashboard,
  Files,
  Images,
  Transactions,
  UpdatePassword,
  UpdateProfile,
  Uploads,
  Videos,
  Audio,
  Documents,
  Downloads,
  BuySpace,
  SellSpace,
  Offer,
  InviteFriends,
  Payments,
} from '../exports';
import {eyeWhite} from '../../images/export';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Feather from 'react-native-vector-icons/Feather';
import {Toast} from 'react-native-toast-message/lib/src/Toast';
import RegistredDevices from './Account/RegistredDevices/RegistredDevices';
import {store} from '../../shared';
import RecycleBin from './Files/RecycleBin/RecycleBin';
import {
  checkForDownloads,
  checkForUploads,
} from '../../shared/slices/Fragmentation/FragmentationService';
import FolderPage from './Files/FolderPage/FolderPage';
import SearchPage from './Files/SearchPage/SearchPage';
import useSocket from '../../shared/socket';
import {HomeIcon, FilesIcon, AccountIcon} from '../../Components/TabbarIcon';
import PushNotification from 'react-native-push-notification';

const Stack = createBottomTabNavigator();
const DashboardContainer =  () => {
  const {initSocket, createOffer} = useSocket();
  const device = store.getState().devices;
  const user_id = store.getState().authentication.userId;

  useEffect(() => {
    initSocket();
  }, [])
  const navigationRef = createNavigationContainerRef()

  const navigate = (name, params) => {
    if (navigationRef.isReady()) {
      navigationRef.navigate(name, params);
    }
  }
  useEffect(() => {
    console.log('create notifications confgure.'); // Initialize the notification service
    PushNotification.configure({
      onRegister: function (token) {
        console.log("TOKEN:", token);
      },    
      onNotification: function (notification) {
        console.log(notification.data)
        if (notification.data.navigate) {
          navigate(notification.data.navigate, {notification: true});
        }
      },
     onAction: function (notification) {
        console.log("ACTION:", notification.action);
        console.log("NOTIFICATION:", notification);
      },

      // (optional) Called when the user fails to register for remote notifications. Typically occurs when APNS is having issues, or the device is a simulator. (iOS)
      onRegistrationError: function(err) {
        console.error(err.message, err);
      },

    });
    // Set up the notification channel (Android only)
    PushNotification.createChannel(
      {
        channelId: 'booing-channel',
        channelName: 'Booing Cloud Channel.',
        channelDescription: 'This is Booing notification.',
        playSound: true,
        importance: 4,
      },
      (created) => console.log(`Channel ${created ? '' : 'not '}created`),
    );    
  }, [])  


  return (
    <>
      <NavigationContainer independent={true} ref={navigationRef}>
        <Stack.Navigator
          initialRouteName="Home"
          screenOptions={({route}) => ({
            tabBarIcon: ({focused, color, size}) => {
              let iconName;
              let rn: string = route.name;
              switch (rn) {
                case 'Files':
                  iconName = focused ? 'folder' : 'folder-outline';
                  break;
                case 'Home' || 'ClearData':
                  iconName = focused ? 'ios-home' : 'ios-home-outline';
                  break;
                case 'Account':
                  iconName = focused ? 'lock-closed' : 'lock-closed-outline';
                  break;
              }
              // You can return any component that you like here!
              if (rn == 'Home') return <HomeIcon active={iconName = focused} />
              if (rn == 'Files') return <FilesIcon active={iconName = focused} />
              if (rn == 'Booingcoin') return <Image style={{width: 26}} source={eyeWhite}/> 
              if (rn == 'Account') return <AccountIcon active={iconName = focused} />
              
              return (
                <Ionicons name={iconName as any} size={22} color={color} />
              );
            },
            headerShown: false,
            "tabBarActiveTintColor": "white",
            "tabBarInactiveTintColor": "whitesmoke",
            "tabBarActiveBackgroundColor": "#33a1f9",
            "tabBarInactiveBackgroundColor": "#33a1f9",
            "tabBarLabelStyle": {
              "fontFamily": 'Rubik-Regular',
              "fontSize": 12,
              "paddingBottom": 20
            },
            "tabBarItemStyle": {
              "backgroundColor": "#33a1f9",
              "paddingTop": 20
            },
            "tabBarStyle": [
              {
                "display": "flex",
                "height": 80
              },
              null
            ]            
          })}
          >
          <Stack.Screen name="Home" component={Dashboard} options={{headerShown: false}} />
          <Stack.Screen
            name="ClearData"
            component={ClearData}
            options={{tabBarItemStyle: {display: 'none'}}}
          />
          <Stack.Screen
            name="BuySpace"
            component={BuySpace}
            options={{
              // headerShown: false,
              tabBarItemStyle: {display: 'none'},
            }}
          />
          <Stack.Screen
            name="SellSpace"
            component={SellSpace}
            options={{
              // headerShown: false,
              tabBarItemStyle: {display: 'none'},
            }}
          />
          <Stack.Screen
            name="Offer"
            component={Offer}
            options={{
              headerShown: false,
              tabBarItemStyle: {display: 'none'},
            }}
          />
          <Stack.Screen name="Files" component={Uploads} />
          <Stack.Screen 
            name="Others" 
            component={Files} 
            options={{
              tabBarItemStyle: {display: 'none'},
            }}
          />
          <Stack.Screen
            name="Uploads"
            component={Uploads}
            options={{
              // headerShown: false,
              tabBarItemStyle: {display: 'none'},
            }}
          />
          <Stack.Screen
            name="Search"
            component={SearchPage}
            options={{
              // headerShown: false,
              tabBarItemStyle: {display: 'none'},
            }}
          />
          <Stack.Screen name="Booingcoin" component={Transactions} />
          <Stack.Screen name="Account" component={Account} />
          <Stack.Screen
            name="UpdateProfile"
            component={UpdateProfile}
            options={{
              // headerShown: false,
              tabBarItemStyle: {display: 'none'},
            }}
          />
          <Stack.Screen
            name="UpdatePassword"
            component={UpdatePassword}
            options={{
              // headerShown: false,
              tabBarItemStyle: {display: 'none'},
            }}
          />
          <Stack.Screen
            name="Folder"
            component={FolderPage}
            options={{
              // headerShown: false,
              tabBarItemStyle: {display: 'none'},
            }}
          />
          <Stack.Screen
            name="InviteFriends"
            component={InviteFriends}
            options={{
              // headerShown: false,
              tabBarItemStyle: {display: 'none'},
            }}
          />
          <Stack.Screen
            name="Images"
            component={Images}
            options={{
              tabBarItemStyle: {display: 'none'},
            }}
          />
          <Stack.Screen
            name="RegistredDevices"
            component={RegistredDevices}
            options={{
              tabBarItemStyle: {display: 'none'},
            }}
          />
          <Stack.Screen
            name="Videos"
            component={Videos}
            options={{
              tabBarItemStyle: {display: 'none'},
            }}
          />
          <Stack.Screen
            name="Audio"
            component={Audio}
            options={{
              tabBarItemStyle: {display: 'none'},
            }}
          />
          <Stack.Screen
            name="Documents"
            component={Documents}
            options={{
              tabBarItemStyle: {display: 'none'},
            }}
          />
          <Stack.Screen
            name="Downloads"
            component={Downloads}
            options={{
              tabBarItemStyle: {display: 'none'},
            }}
          />
          <Stack.Screen
            name="Apks"
            component={Apks}
            options={{
              tabBarItemStyle: {display: 'none'},
            }}
          />
          <Stack.Screen
            name="RecycleBin"
            component={RecycleBin}
            options={{
              tabBarItemStyle: {display: 'none'},
            }}
          />
          <Stack.Screen
            name="Payments"
            component={Payments}
            options={{
              tabBarItemStyle: {display: 'none'},
            }}
          />
        </Stack.Navigator>
      </NavigationContainer>
      <Toast />
    </>
  );
};

export default DashboardContainer;
