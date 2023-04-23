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
import {setStorage, setLastFetchTime, setFilesList} from '../../../../shared/slices/Auth/AuthSlice';
import {CleanModal, ClearDataHeader} from './components';
import Buffer from 'buffer';
import mime from 'mime-types';
import {types} from '../../../../shared';
import {useSelector} from 'react-redux';

const calcSpace = (arr: {size: number}[], field = 'size', minVal = 0) =>
  arr.reduce((acc, elem) => acc + (elem as any)[field], 0) > minVal
    ? arr.reduce((acc, elem) => acc + (elem as any)[field], 0)
    : 0;

const addId = (arr: []) => {
  arr.forEach(e => ((e as any).id = nanoid(20)));
  return arr;
};    

function ClearData({route, navigation}: {navigation: any; route: any}) {
  const {freeDiskStorage} = route.params;
  const [showData, setShowData] = useState(false);
  const [showModal, setShowModal] = useState<{show: boolean; loading: boolean}>(
    {show: true, loading: false},
  );
  const [media, setMedia] = useState({
    document: [],
    apk: [],
    video: [],
    audio: [],
    image: [],
    download: [],
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
  // const lastFetchTime = useSelector(state => state.authentication.lastFetchTime);
  const lastFetchTime = useSelector(state => state.authentication.lastFetchTime);
  const filesList = useSelector(state => state.authentication.filesList);

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
  const fetchFiles = useCallback(async (filePath) => {
    // const delaytime = await delay(1500); 
    showMessage({text: `fetching ${filePath}`, progress: 0.2})
    const files = await RNFS.readdir(filePath);
    const subPath = filePath.split('/').pop();
    let allFiles = [];
    if (files) {
      for (let i = 0; i < files.length; i++) {
        const rpath = `${filePath}/${files[i]}`;
          const fileStat = await RNFS.stat(rpath);
          if (fileStat.isDirectory()) {
            if (files[i] !== 'Android' && !files[i].startsWith('.')) {
            const subFiles = await fetchFiles(rpath);
            if (Object.keys(subFiles).length !== 0) {
              allFiles = [ ...allFiles, ...subFiles];
            }
            }
          } else {
            if (fileStat.mtime <= lastFetchTime) {
              const file = filesList.find(obj => obj.path===fileStat.path);
              if (file) {
                allFiles.push(file);
                console.log(rpath, 'not changed files')
                continue ;
              }
            }
            console.log('new File ', fileStat.path)
            const hash = await RNFS.hash(fileStat.path, 'md5');
            allFiles.push({
              ctime: fileStat.ctime,
              mtime: fileStat.mtime,
              path: fileStat.path,
              size: fileStat.size,
              hash: hash,
              name: fileStat.path.split('/').pop()
            })
          }
      }
    }
    return addId(allFiles);
  }, [isFocused])
  const delay = (delayInms) => {
    return new Promise(resolve => setTimeout(resolve, delayInms));
  }  
  const separateByCategory = useCallback(async (files) => {
    const allFilesByCategory = {document: [], apk: [], video: [], audio: [], image: [], download: []};
    for (let i = 0; i < files.length; i++) {
      const mimeType = await mime.lookup(files[i]['path']);
      const validType = Object.keys(types).find(key => (types as any)[key](mimeType));
      if (validType) {
        if (validType === 'image' || validType === 'video') {
          const thumnail = await ManageApps.getThumbnailBase64FromPath(files[i]['path'], validType==='image');
          allFilesByCategory[validType].push({...files[i], thumbnail: thumnail});
        } else {
          allFilesByCategory[validType].push(files[i]);
        }
      }
    }
    setMedia(allFilesByCategory)
    findDuplicatedFiles(allFilesByCategory);
  }, [isFocused, media])
  const findDuplicatedFiles = useCallback((categoriedFiles) => {
    const duplicateArr = {document: [], apk: [], video: [], audio: [], image: [], download: []};
    for (let type in categoriedFiles) {
      const arr = [];
      showMessage({text: `find duplicated ${type}s`, progress: 0.8})
      categoriedFiles[type].forEach((obj) => {
        if (arr.hasOwnProperty(obj.hash)) {
          arr[obj.hash].push(obj);
        } else {
          arr[obj.hash] = [obj];
        }
      });
      for (const [key, value] of Object.entries(arr)) {
        if (value.length > 1) {
          duplicateArr[type] = [...duplicateArr[type], ...value]
        }
      }
    }
    // console.log(duplicateArr)
    setDuplicate(duplicateArr)
  }, [isFocused, media])
  const scanUserStorage = useCallback(async () => {
    // setTimeout(() => {
    //   setShowModal({show: false, loading: false});
    // }, 200);
    // setShowData(true);    
    try {
      setClearManually(false);
      setRescanOnFocus(false);
      store.dispatch(setRootLoading(false));
      setShowModal({show: true, loading: true});

      const fetchTime = Date.now();
      const files = await fetchFiles(RNFS.ExternalStorageDirectoryPath);
      store.dispatch(setLastFetchTime(fetchTime));
      store.dispatch(setFilesList(files));

      await separateByCategory(files)
      // store.dispatch(setRootLoading(false));
      // setShowModal({show: true, loading: true});
      // // setApps(addId(await ManageApps.getAllInstalledApps()));
      // showMessage({text: 'fetching images ...', progress: 0});
      // const allImages = addId(await ManageApps.getImages());
      // showMessage({text: 'fetching videos ...', progress: 0.15});
      // const allVideos = addId(await ManageApps.getVideos());
      // showMessage({text: 'fetching audio files ...', progress: 0.3});
      // const allAudios = addId(await ManageApps.getAudios());
      // await findDuplicateFiles({images: allImages, videos: allVideos, audios: allAudios});
      // showMessage({text: 'find all apks ...', progress: 0.85});
      // setMedia({images: allImages, videos: allVideos, audios: allAudios});
      // showMessage({text: 'done !', progress: 1});
      // setApps(addId(await ManageApps.getAllApks()))
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

  // useEffect(() => {
  //   console.log(lastFetchTime, filesList)
  // }, [lastFetchTime, filesList])

  const refechByLabel = async (ids: string[], type: string) => {
    console.log('refechByLabel', ids, type)
    if (type === 'image' || type === 'video' || type === 'audio') {
      setDuplicate({...duplicate, [type]: duplicate[type].filter((item: any) => !ids.includes(item.id))});
      setMedia({...media, [type]: media[type].filter((item: any) => !ids.includes(item.id))});
    }
  };
 
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
                    data={media.image as []}
                    label="Pictures"
                    type="image"
                    size={calcSpace(media.image)}
                    removeDeletedItems={removeDeletedItems}
                    refetchByLabel={refechByLabel}
                    setCategoryView={setCategoryView}
                    categoryView={categoryView}
                  />
                  <DateList
                    data={media.video as []}
                    label="Videos"
                    type="video"
                    removeDeletedItems={removeDeletedItems}
                    size={calcSpace(media.video)}
                    refetchByLabel={refechByLabel}
                    setCategoryView={setCategoryView}
                    categoryView={categoryView}
                  />
                  <DateList
                    data={media.audio as []}
                    label="Music"
                    type="audio"
                    removeDeletedItems={removeDeletedItems}
                    size={calcSpace(media.audio)}
                    refetchByLabel={refechByLabel}
                    setCategoryView={setCategoryView}
                    categoryView={categoryView}
                  />
                  <DateList
                    data={media.apk as []}
                    label="APK"
                    type="apk"
                    removeDeletedItems={removeDeletedItems}
                    size={calcSpace(media.apk)}
                    refetchByLabel={refechByLabel}
                    setCategoryView={setCategoryView}
                    categoryView={categoryView}
                  />
                  <CacheWrapper
                    label="Cache Files"
                    setCategoryView={setCategoryView}
                    refetchByLabel={refechByLabel}
                    categoryView={categoryView}
                    apps={media.apk.filter((item: any) => !item.installed)}
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
