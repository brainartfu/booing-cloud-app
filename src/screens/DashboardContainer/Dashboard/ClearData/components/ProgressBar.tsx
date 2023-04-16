import React from 'react';
import {View, Text} from 'react-native';
import {Bar} from 'react-native-progress';

const ProgressBar = ({progress, text}: any) => {
  return (
    <View>
      <Text
        style={{
          textAlign: 'center',
          marginBottom: 20,
          color: text === 'done !' ? 'green' : 'black',
          fontWeight: '500',
        }}>
        {text}
      </Text>
      <Bar progress={progress} height={10} />
    </View>
  );
};

export default ProgressBar