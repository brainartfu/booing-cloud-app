/* eslint-disable react-hooks/exhaustive-deps */
import React, {useCallback, useEffect, useState} from 'react';
import {ScrollView, View, Text, StyleSheet, Button, BackHandler, Pressable} from 'react-native';
import ManageApps from '../../../../utils/manageApps';
import { FilesList, CacheWrapper, DuplicateWrapper, DateList } from '../FilesList';
import {isAllOf, nanoid} from '@reduxjs/toolkit';
import Toast from 'react-native-toast-message';
import RNFS from 'react-native-fs';
import {useIsFocused} from '@react-navigation/native';
import {store} from '../../../../shared';
import {setRootLoading} from '../../../../shared/slices/rootSlice';
import {sellSpace} from '../../../../shared/slices/Fragmentation/FragmentationService';
import {setStorage} from '../../../../shared/slices/Auth/AuthSlice';
import {CleanModal, ClearDataHeader} from './components';
import Buffer from 'buffer';

const calcSpace = (arr: {size: number}[], field = 'size', minVal = 0) =>
  arr.reduce((acc, elem) => acc + (elem as any)[field], 0) > minVal
    ? arr.reduce((acc, elem) => acc + (elem as any)[field], 0)
    : 0;

function ClearData({route, navigation}: {navigation: any; route: any}) {
  const {freeDiskStorage} = route.params;
  const [showData, setShowData] = useState(false);
  const [showModal, setShowModal] = useState<{show: boolean; loading: boolean}>(
    {show: true, loading: false},
  );
  const [media, setMedia] = useState({
    images: [],
    videos: [],
    audios: []
  });
  const [images, setImages] = useState([]);
  const [videos, setVideos] = useState([]);
  const [music, setMusic] = useState([]);
  const [apps, setApps] = useState([]);
  const [duplicate, setDuplicate] = useState([]);
  const [totalCacheSize, setTotalCacheSize] = useState([]);
  const [thumbnails, setThumbnails] = useState([]);
  const [emptyFolders, setEmptyFolders] = useState([]);
  const [notInstalledApks, setNotInstalledApks] = useState([]);
  const [cancelPopup, setCancelPopup] = useState<boolean>(false);
  const [isSelledSpace, setIsSelledSpace] = useState<boolean>(false);
  const [rescanOnFocuse, setRescanOnFocus] = useState(true);
  const [clearManually, setClearManually] = useState(false);
  const [categoryView, setCategoryView] = useState('All')
  const [refresh, setRefresh] = useState(true)
  const user_id = store.getState().authentication.userId;

  const [progressProps, setProgressProps] = useState({
    text: '',
    progress: 0,
  });

  const isFocused = useIsFocused();

  const addId = (arr: []) => {
    arr.forEach(e => ((e as any).id = nanoid(20)));
    return arr;
  };

  const showMessage = ({text, progress}) => {
    console.log(text, progress)
    if (isFocused) {
      setProgressProps({text: text, progress: progress});
    } 
    ManageApps.showNotification(
      "Hey, I'm optimizing your device's space.",
      `${text}    ${progress*100}%`,
      100, progress*100, // progress bar
      true               // set silent
    );
  }
  const delay = (delayInms) => {
    return new Promise(resolve => setTimeout(resolve, delayInms));
  }  
  const scanUserStorage = useCallback(async () => {
    // console.log(await ManageApps.getImages())
    // console.log(await ManageApps.getVideos())
    // console.log(await ManageApps.getAudios())
    // const uris = [
    //   "content://media/external/images/media/35",
    //   "content://media/external/images/media/32",
    //   "content://media/external/images/media/33",
    //   "content://media/external/images/media/34",
    //   "content://media/external/images/media/54",
    // ]
    // console.log(await ManageApps.getMediaThumbnails(uris, true))
    // console.log('total media size', await ManageApps.getTotalMediaSize()) //
    // console.log('total cache size', await ManageApps.getTotalCacheSize()) //
    // console.log(await ManageApps.getAllFiles())
    // console.log(await ManageApps.getAllApks())

    try {
      setClearManually(false);
      setRescanOnFocus(false);
      store.dispatch(setRootLoading(false));
      setShowModal({show: true, loading: true});
      // setApps(addId(await ManageApps.getAllInstalledApps()));
      showMessage({text: 'fetching images ...', progress: 0});
      const allImages = addId(await ManageApps.getImages());
      showMessage({text: 'fetching videos ...', progress: 0.15});
      const allVideos = addId(await ManageApps.getVideos());
      showMessage({text: 'fetching audio files ...', progress: 0.3});
      const allAudios = addId(await ManageApps.getAudios());
      await findDuplicateFiles({images: allImages, videos: allVideos, audios: allAudios});
      showMessage({text: 'find all apks ...', progress: 0.85});
      setMedia({images: allImages, videos: allVideos, audios: allAudios});
      showMessage({text: 'done !', progress: 1});
      setApps(addId(await ManageApps.getAllApks()))
      // const delaytime = await delay(1000);
    } catch (e: any) {
      console.log(e.stack);
    } finally {
      setTimeout(() => {
        setShowModal({show: false, loading: false});
      }, 200);
      setShowData(true);
      ManageApps.showNotification(
        'Scan Completed',
        'you can find all your junk files in the scan page',
        0, 0,  // remove progress bar
        false  // sound ring
      );
    }
  }, [isFocused, refresh]);

  const removeDeletedItems = (ids: string[], label: string) => {
    console.log('removeDeletedItems', ids, label)
    // const removeItems = (setFn: Function) => {
    //   setFn((arr: []) => arr.filter((item: any) => !ids.includes(item.id)));
    // };
    // switch (label) {
    //   case 'Pictures':
    //     removeItems(setImages);
    //     analyseStorage();
    //     break;
    //   case 'Videos':
    //     removeItems(setVideos);
    //     analyseStorage();
    //     break;
    //   case 'Music':
    //     removeItems(setMusic);
    //     analyseStorage();
    //     break;
    //   // case 'Cache':
    //   //   removeItems(setApps);
    //   //   break;
    //   case 'Thumbnails':
    //     removeItems(setThumbnails);
    //     break;
    //   case 'Empty folders':
    //     removeItems(setEmptyFolders);
    //     break;
    //   case 'Not installed apks':
    //     removeItems(setNotInstalledApks);
    //     break;
    //   default:
    //     break;
    // }
  };

  const refechByLabel = async (ids: string[], type: string) => {
    console.log('refechByLabel', ids, type)
    if (type === 'images' || type === 'videos' || type === 'audios') {
      setDuplicate({...duplicate, [type]: duplicate[type].filter((item: any) => !ids.includes(item.id))});
      setMedia({...media, [type]: media[type].filter((item: any) => !ids.includes(item.id))});
    } else if (type === 'apks') {
      setApps(apps.filter((item: any) => !ids.includes(item.id)))
    }
  };
  
  const findDuplicateFiles = async (media) => {
    let duplicatedFiles = {};
    let pro = 0.3;
    for (let type in media) {
      pro = Math.round((pro + 0.15) * 100) / 100;
      showMessage({text: `find duplicated ${type} ...`, progress: pro});
      let data = media[type];
      let dupleFiles = [];
      data.sort((a, b) => a.size - b.size);
      let temp = "";
      let sizeArr = {};
      for (let i = 0; i < data.length; i++) {
        if (sizeArr[data[i].size]) sizeArr[data[i].size].push(data[i]);
        else sizeArr[data[i].size] = [data[i]]
      }
      for (let key in sizeArr) {
        if (sizeArr[key].length > 1) {
          const arr = sizeArr[key];
          for (let i = 0; i < arr.length; i++) {
            arr[i]['temp'] = await RNFS.read(arr[i].path, 1000, 0, 'base64');
          }
          for (let i = 0; i < arr.length; i++) {
            for (let j = i+1; j < arr.length; j++) {
              if (arr[i]['temp'] === arr[j]['temp']) {
                if (!arr[i]['dupl']) {
                  arr[i]['dupl'] = nanoid(20);
                  // dupleFiles[arr[i]['dupl']] = [arr[i]];
                  dupleFiles.push(arr[i])
                }
                if (!arr[j]['dupl']) {
                 arr[j]['dupl'] = arr[i]['dupl'];
                  // dupleFiles[arr[i]['dupl']].push(arr[j]);
                  dupleFiles.push(arr[j]) 
                }
              } else console.log('differnt')
            }
          }
        }
      }
      duplicatedFiles[type] = dupleFiles;
    }
    setDuplicate(duplicatedFiles)
  }

  useEffect(() => {
    const backAction = (e) => {
      if (categoryView !== 'All') {
        setCategoryView('All');
        return true;
      } else {
        return false;
      }
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction,
    );

    return () => backHandler.remove();
  }, []);    
  const handleSellSpace = async (quantity) => {
    if (quantity < 500) {
        return Toast.show({
          type: 'error',
          text1: 'amount must be more than 500Mb.'
        })
    } else {
      await sellSpace({user_id, quantity}).then(res => {
        if (res.success) {
          setIsSelledSpace(true);
          return Toast.show({
            type: "success",
            text1: res.msg
          })
        } else {
          return Toast.show({
            type: 'error',
            text1: res.msg
          })
        }
      })
    }
  }
  useEffect(() => {
    (async () => {
      const cacheSize = await ManageApps.getTotalCacheSize();
      console.log('cache size',  Math.ceil((cacheSize / Math.pow(1024, 2))*100)/100)
      setTotalCacheSize(Math.ceil((cacheSize / Math.pow(1024, 2))*100)/100);    
    })();

    if (!showData) {
      if (isFocused && showModal.loading === false && showModal.show === false) {
        if (rescanOnFocuse) {
          setShowData(false);
          setShowModal({show: true, loading: false});
          setProgressProps({text: '', progress: 0});
          setRescanOnFocus(false);
        }
      }

      if (
        !isFocused &&
        showData &&
        showModal.loading === false &&
        showModal.show === false
      ) {
        setRescanOnFocus(true);
      }
    } else {
      setShowModal({show: false, loading: false});
    }
  }, [isFocused, rescanOnFocuse]);
  useEffect(() => {
    console.log(categoryView)
  }, [categoryView])
  return (
    <View style={styles.container}>
      <CleanModal 
        showModal={showModal} 
        progressProps={progressProps} 
        scan={scanUserStorage} 
      />
      <View style={{width: '100%'}}>
        <ClearDataHeader 
          freeDiskStorage={freeDiskStorage} 
          navigation={navigation} 
        />
      </View>
      <ScrollView style={styles.scrollView}>
        <View style={styles.main}>
          {showData && (
            <>
                <>
                  {!cancelPopup && !isSelledSpace && categoryView==="All" && totalCacheSize > 0 && (
                    <View style={styles.sellContainer}>
                      {/*<Text
                        style={styles.sellOffer}>
                        Do you want sell {Math.round(freeDiskStorage / 2)} Gb of free space for{' '}
                        {Math.round(65000 * Math.round(freeDiskStorage / 2))} Boo
                        coin ?
                      </Text>*/}
                      <Text
                        style={styles.sellOffer}>
                        Can I recover {Math.round(totalCacheSize*100 / 2)/100} Mb of free space for you? Rent me 50% of recovered space for {Math.round(65 * totalCacheSize *100 / 2)/100} Boo!
                      </Text>
                      <View style={{
                        width: '30%',
                        flexDirection: 'row',
                        justifyContent: 'center',
                      }}>
                        <Pressable onPress={() => setCancelPopup(true)} style={[styles.offerBtn, {backgroundColor: '#F4F7F8'}]}>
                          <Text style={[styles.offerBtnText, {color: '#929292'}]}>No</Text>
                        </Pressable>
                        <View style={{width: 10}}></View>
                        <Pressable onPress={() => handleSellSpace(Math.round(totalCacheSize / 2))} style={styles.offerBtn}>
                          <Text style={styles.offerBtnText}>Yes</Text>
                        </Pressable>
                      </View>
                    </View>
                  )}

                  <DateList
                    data={media.images as []}
                    label="Pictures"
                    type="images"
                    size={calcSpace(media.images)}
                    removeDeletedItems={removeDeletedItems}
                    refetchByLabel={refechByLabel}
                    setCategoryView={setCategoryView}
                    categoryView={categoryView}
                  />
                  <DateList
                    data={media.videos as []}
                    label="Videos"
                    type="videos"
                    removeDeletedItems={removeDeletedItems}
                    size={calcSpace(media.videos)}
                    refetchByLabel={refechByLabel}
                    setCategoryView={setCategoryView}
                    categoryView={categoryView}
                  />
                  <DateList
                    data={media.audios as []}
                    label="Music"
                    type="audios"
                    removeDeletedItems={removeDeletedItems}
                    size={calcSpace(media.audios)}
                    refetchByLabel={refechByLabel}
                    setCategoryView={setCategoryView}
                    categoryView={categoryView}
                  />
                  <DateList
                    data={apps as []}
                    label="APK"
                    type="apks"
                    removeDeletedItems={removeDeletedItems}
                    size={calcSpace(apps)}
                    refetchByLabel={refechByLabel}
                    setCategoryView={setCategoryView}
                    categoryView={categoryView}
                  />
                  <CacheWrapper
                    label="Cache Files"
                    setCategoryView={setCategoryView}
                    refetchByLabel={refechByLabel}
                    categoryView={categoryView}
                    apps={apps.filter((item: any) => !item.installed)}
                  />
                  <DuplicateWrapper
                    data={duplicate}
                    label="Duplicated Files"
                    size={0}
                    removeDeletedItems={removeDeletedItems}
                    refetchByLabel={refechByLabel}
                    setCategoryView={setCategoryView}
                    categoryView={categoryView}
                  />
                  
                </>
              {categoryView !== 'All' ? (
                <>
                  {/*<FilesList
                                      data={[...images, ...videos, ...music]}
                                      label="Manually"
                                      size={calcSpace([...images, ...videos, ...music])}
                                      removeDeletedItems={removeDeletedItems}
                                      refetchByLabel={refechByLabel}
                                      setCategoryView={setCategoryView}
                                      categoryView={categoryView}
                                    />*/}
                  <View style={{marginTop: 10}} />
                  <Button
                    title="return"
                    onPress={() => setCategoryView('All')}
                  />                 
                </>
              ) : (
                <>
                  <View style={{marginTop: 10}}></View>
                  <Button
                   title="free up space (manullay)"
                   // onPress={() => setCategoryView('Manually')}
                   onPress={async () => await ManageApps.freeSpace()}
                 />
                 {/*<Button
                    title="free up space (manullay)"
                    onPress={async () => await ManageApps.freeSpace()}
                  />*/}
                  <View style={{marginTop: 10}} />
                  <Button
                    title="clear all"
                    onPress={async () => await ManageApps.clearAllVisibleCache()}
                  />  
                </>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    marginHorizontal: 0,
    width: '100%',
  },
  container: {
    flex: 1,
    backgroundColor: '#F2F6F7',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  main: {
    width: '100%',
    paddingLeft: 20,
    paddingRight: 20,
    paddingBottom: 30,
    paddingTop: 30,
  },
  sellOffer: {
    width: '60%',
    marginRight: 30,
    color: '#75B7FA',
    fontFamily: 'Rubik-Regular', 
    fontSize: 13, 
    lineHeight: 20,
    letterSpacing: 0.02,
  },
  offerBtn: {
    height: 25,
    width: 50,
    backgroundColor: '#6DBDFE',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15
  },
  offerBtnText: {
    color: 'white'
  },
  sellContainer: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#FCFCFC',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    // elevation: 5,
    marginBottom: 10,
    flexDirection: 'row',
    width: '100%',
    // justifyContent: 'space-between',
    alignItems: 'center'    
  }
});

export default ClearData;
