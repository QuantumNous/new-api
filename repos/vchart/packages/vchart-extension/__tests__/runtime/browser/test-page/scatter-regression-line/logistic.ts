import { registerRegressionLine } from '../../../../../src/components/regression-line/regression-line';
import { appendScatterRegressionLineConfig } from '../../../../../src/components/scatter-regression-line';
import { default as VChart } from '@visactor/vchart';

const data = [
  {
    Survived: 0,
    Sex: 'male',
    Age: 55
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 49
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 36
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 19
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 14
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 55
  },
  {
    Survived: 0,
    Sex: 'female',
    Age: null
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 28
  },
  {
    Survived: 0,
    Sex: 'female',
    Age: 45
  },
  {
    Survived: 1,
    Sex: 'male',
    Age: 6
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 36
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 28
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 1
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 18
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 33
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 52
  },
  {
    Survived: 1,
    Sex: 'male',
    Age: 29
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 17
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 29
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 28
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 7
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 19
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 26
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 36
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 21
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 28
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 29
  },
  {
    Survived: 1,
    Sex: 'male',
    Age: 21
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 44
  },
  {
    Survived: 1,
    Sex: 'male',
    Age: 0.42
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 34
  },
  {
    Survived: 1,
    Sex: 'male',
    Age: 16
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 30
  },
  {
    Survived: 1,
    Sex: 'male',
    Age: 28
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 26
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 36
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 47
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 31
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 13
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: null
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 19
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 18
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 22
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 17
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 40
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 36
  },
  {
    Survived: 1,
    Sex: 'male',
    Age: 1
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 18
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 28
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 58
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 28.5
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 24
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 36
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 23
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 65
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 52
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 32
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 35
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 27
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 15
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 20
  },
  {
    Survived: 1,
    Sex: 'male',
    Age: 39
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 71
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 33
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 36
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 5
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 17
  },
  {
    Survived: 0,
    Sex: 'female',
    Age: 10
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 60
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 48
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 22
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 40.5
  },
  {
    Survived: 1,
    Sex: 'male',
    Age: 36
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 33
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 30
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 62
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 25
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 2
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: null
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 34
  },
  {
    Survived: 1,
    Sex: 'male',
    Age: 36
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 35
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 18
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 45
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 63
  },
  {
    Survived: 1,
    Sex: 'male',
    Age: 30
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 19
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 18
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: null
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 24
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 30
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 40.5
  },
  {
    Survived: 0,
    Sex: 'female',
    Age: 24
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: null
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 34
  },
  {
    Survived: 1,
    Sex: 'male',
    Age: 32
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 27
  },
  {
    Survived: 1,
    Sex: 'male',
    Age: null
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 42
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 32
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 22
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 33
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 48
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 47
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 30
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 16
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: null
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 62
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 46
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 17
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 35
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 19
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: null
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 25
  },
  {
    Survived: 1,
    Sex: 'male',
    Age: 1
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 29
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 29
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 51
  },
  {
    Survived: 1,
    Sex: 'male',
    Age: 19
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 35
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 54
  },
  {
    Survived: 1,
    Sex: 'male',
    Age: 34
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 13
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 30
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 38
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 38
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: null
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 18
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 51
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 27
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 20
  },
  {
    Survived: 1,
    Sex: 'male',
    Age: 3
  },
  {
    Survived: 1,
    Sex: 'male',
    Age: null
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 30
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 25
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 23
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 28
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 22
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 53
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 39
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 33
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 28
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: null
  },
  {
    Survived: 0,
    Sex: 'female',
    Age: 50
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 55.5
  },
  {
    Survived: 0,
    Sex: 'female',
    Age: 25
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 20
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 31
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 32
  },
  {
    Survived: 0,
    Sex: 'female',
    Age: 3
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 33
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: null
  },
  {
    Survived: 0,
    Sex: 'female',
    Age: 39
  },
  {
    Survived: 0,
    Sex: 'female',
    Age: 2
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 21
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 18
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 47
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 51
  },
  {
    Survived: 1,
    Sex: 'male',
    Age: 52
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 27
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 45
  },
  {
    Survived: 0,
    Sex: 'female',
    Age: 29
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 39
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 31
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 30
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 16
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 32
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 51
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 17
  },
  {
    Survived: 0,
    Sex: 'female',
    Age: 18
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 21
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 18
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 64
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 16
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: null
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 70
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 25
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 54
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 34
  },
  {
    Survived: 1,
    Sex: 'male',
    Age: 23
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 2
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 29
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 43
  },
  {
    Survived: 1,
    Sex: 'male',
    Age: 0.67
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 56
  },
  {
    Survived: 0,
    Sex: 'female',
    Age: 27
  },
  {
    Survived: 1,
    Sex: 'male',
    Age: 80
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 28
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 33
  },
  {
    Survived: 0,
    Sex: 'female',
    Age: 18
  },
  {
    Survived: 0,
    Sex: 'female',
    Age: 39
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 25
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 40
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 28
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 38
  },
  {
    Survived: 1,
    Sex: 'male',
    Age: null
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 25
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 16
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 14
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 34
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 54
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 33
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 42
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 27
  },
  {
    Survived: 0,
    Sex: 'female',
    Age: 16
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 43
  },
  {
    Survived: 1,
    Sex: 'male',
    Age: 25
  },
  {
    Survived: 1,
    Sex: 'male',
    Age: 26
  },
  {
    Survived: 1,
    Sex: 'male',
    Age: 31
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 30
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 40
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 54
  },
  {
    Survived: 0,
    Sex: 'female',
    Age: 2
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 38
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 47
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 29
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 33
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 34
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 35
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 16
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 25
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 23
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 25
  },
  {
    Survived: 1,
    Sex: 'male',
    Age: 38
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 43
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 30.5
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 21
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 27
  },
  {
    Survived: 1,
    Sex: 'male',
    Age: null
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 7
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 30
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: null
  },
  {
    Survived: 1,
    Sex: 'male',
    Age: 32
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 46
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 41
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 17
  },
  {
    Survived: 1,
    Sex: 'male',
    Age: 26
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 16
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 24
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 7
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 23
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 62
  },
  {
    Survived: 0,
    Sex: 'female',
    Age: null
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 15
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 38
  },
  {
    Survived: 1,
    Sex: 'male',
    Age: 32
  },
  {
    Survived: 1,
    Sex: 'male',
    Age: 3
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 30
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 19
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 45.5
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 58
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 26
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 30
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 60
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 24
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 24
  },
  {
    Survived: 0,
    Sex: 'female',
    Age: 26
  },
  {
    Survived: 0,
    Sex: 'female',
    Age: 40
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 40
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 30
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 14
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 18
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 24.5
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 54
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 16
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 32
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 22
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 19
  },
  {
    Survived: 0,
    Sex: 'female',
    Age: 28
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 65
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 60
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: null
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 24
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 28
  },
  {
    Survived: 0,
    Sex: 'female',
    Age: 25
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 48
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 58
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 19
  },
  {
    Survived: 1,
    Sex: 'male',
    Age: 50
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 15
  },
  {
    Survived: 0,
    Sex: 'female',
    Age: 30
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 24
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 44
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 42
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 45.5
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 51
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 24
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 39
  },
  {
    Survived: 1,
    Sex: 'male',
    Age: 42
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 21
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 30
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 5
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 26
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: null
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 19
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 4
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 29
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 18
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 61
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 29
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 37
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 34
  },
  {
    Survived: 0,
    Sex: 'female',
    Age: 37
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: null
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: null
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: null
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 28
  },
  {
    Survived: 1,
    Sex: 'male',
    Age: 25
  },
  {
    Survived: 1,
    Sex: 'male',
    Age: 25
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 39
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 33
  },
  {
    Survived: 1,
    Sex: 'male',
    Age: 51
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 70.5
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 34
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 39
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 28.5
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 16
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 18
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 36
  },
  {
    Survived: 0,
    Sex: 'female',
    Age: 48
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 24
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 24
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: null
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 18
  },
  {
    Survived: 0,
    Sex: 'female',
    Age: 14.5
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 61
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 36
  },
  {
    Survived: 1,
    Sex: 'male',
    Age: 2
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 21
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 41
  },
  {
    Survived: 0,
    Sex: 'female',
    Age: 22
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 23
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 1
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 50
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 21
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 24
  },
  {
    Survived: 1,
    Sex: 'male',
    Age: 20
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 10
  },
  {
    Survived: 1,
    Sex: 'male',
    Age: 49
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 24
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 45
  },
  {
    Survived: 0,
    Sex: 'female',
    Age: 57
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 40
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 21
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 33
  },
  {
    Survived: 1,
    Sex: 'male',
    Age: 24
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 22
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 25
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 30
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 16
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 38
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 20
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 30
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 17
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 35
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 46
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 19
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 27
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 25
  },
  {
    Survived: 0,
    Sex: 'female',
    Age: 23
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 40
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 31
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: null
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 24
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 50
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 45
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 2
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 59
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 61
  },
  {
    Survived: 1,
    Sex: 'male',
    Age: 48
  },
  {
    Survived: 1,
    Sex: 'male',
    Age: 3
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 19
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 27
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 28
  },
  {
    Survived: 1,
    Sex: 'male',
    Age: 11
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 39
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 29
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 38
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 44
  },
  {
    Survived: 1,
    Sex: 'male',
    Age: 48
  },
  {
    Survived: 1,
    Sex: 'male',
    Age: 19
  },
  {
    Survived: 0,
    Sex: 'female',
    Age: 9
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 42
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 39
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 30
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 52
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 42
  },
  {
    Survived: 0,
    Sex: 'female',
    Age: 30.5
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 30
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 19
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 4
  },
  {
    Survived: 0,
    Sex: 'female',
    Age: 17
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 35
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 54
  },
  {
    Survived: 1,
    Sex: 'male',
    Age: 20
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 17
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 35
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 17
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 58
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 22
  },
  {
    Survived: 1,
    Sex: 'male',
    Age: null
  },
  {
    Survived: 0,
    Sex: 'female',
    Age: 11
  },
  {
    Survived: 0,
    Sex: 'female',
    Age: null
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 31
  },
  {
    Survived: 0,
    Sex: 'female',
    Age: null
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 47
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 22
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 19
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 31
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 23
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 59
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 8
  },
  {
    Survived: 0,
    Sex: 'female',
    Age: 22
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: null
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 37
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 20
  },
  {
    Survived: 0,
    Sex: 'female',
    Age: 25
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 39
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 19
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: null
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 26
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 18
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 22
  },
  {
    Survived: 0,
    Sex: 'female',
    Age: 45
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 22
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 29
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 54
  },
  {
    Survived: 1,
    Sex: 'male',
    Age: 45
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 26
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 0.75
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 28
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 43
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 28
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 27
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 38
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 21
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 36
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: null
  },
  {
    Survived: 0,
    Sex: 'female',
    Age: 20
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 4
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 19
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 47
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 27
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 21
  },
  {
    Survived: 1,
    Sex: 'male',
    Age: 25
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 29
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 33
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 20
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 19
  },
  {
    Survived: 0,
    Sex: 'female',
    Age: 32
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 16
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 25
  },
  {
    Survived: 0,
    Sex: 'female',
    Age: 21
  },
  {
    Survived: 1,
    Sex: 'male',
    Age: 31
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: null
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 52
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 31
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 38
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 28
  },
  {
    Survived: 1,
    Sex: 'male',
    Age: 31
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 18
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 24
  },
  {
    Survived: 0,
    Sex: 'female',
    Age: 43
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: null
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 48
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 47
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 24
  },
  {
    Survived: 1,
    Sex: 'male',
    Age: null
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 22
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 1
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 4
  },
  {
    Survived: 0,
    Sex: 'female',
    Age: 31
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 42
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 24
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 33
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 2
  },
  {
    Survived: 1,
    Sex: 'male',
    Age: 62
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 30
  },
  {
    Survived: 0,
    Sex: 'female',
    Age: 21
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 58
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 26
  },
  {
    Survived: 0,
    Sex: 'female',
    Age: 44
  },
  {
    Survived: 1,
    Sex: 'male',
    Age: 27
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 16
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 2
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 50
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 28
  },
  {
    Survived: 0,
    Sex: 'female',
    Age: 28
  },
  {
    Survived: 1,
    Sex: 'male',
    Age: 0.83
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 42
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: null
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 70
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 22
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 28
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 25
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 22
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 21
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 32
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 23.5
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 49
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 22
  },
  {
    Survived: 1,
    Sex: 'male',
    Age: null
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 22
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 35
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 32.5
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 56
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 42
  },
  {
    Survived: 1,
    Sex: 'male',
    Age: null
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 41
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 24
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 26
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 23
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 21
  },
  {
    Survived: 1,
    Sex: 'male',
    Age: 44
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 33
  },
  {
    Survived: 1,
    Sex: 'male',
    Age: 37
  },
  {
    Survived: 0,
    Sex: 'female',
    Age: 41
  },
  {
    Survived: 1,
    Sex: 'male',
    Age: 20
  },
  {
    Survived: 1,
    Sex: 'male',
    Age: 32
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 24
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 24
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 22
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 16
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 25
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 14
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 5
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 32.5
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 4
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 37
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 18
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 30
  },
  {
    Survived: 0,
    Sex: 'female',
    Age: 38
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 14
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 22
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 64
  },
  {
    Survived: 1,
    Sex: 'male',
    Age: 29
  },
  {
    Survived: 1,
    Sex: 'male',
    Age: 35
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 39
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 25
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 20
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 52
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 20
  },
  {
    Survived: 1,
    Sex: 'male',
    Age: null
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: null
  },
  {
    Survived: 1,
    Sex: 'male',
    Age: 32
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 36
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 23
  },
  {
    Survived: 0,
    Sex: 'female',
    Age: 45
  },
  {
    Survived: 0,
    Sex: 'female',
    Age: 9
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 16
  },
  {
    Survived: 1,
    Sex: 'male',
    Age: 1
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 18
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 28
  },
  {
    Survived: 1,
    Sex: 'male',
    Age: 27
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 23
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 34
  },
  {
    Survived: 1,
    Sex: 'male',
    Age: 42
  },
  {
    Survived: 0,
    Sex: 'female',
    Age: 6
  },
  {
    Survived: 1,
    Sex: 'male',
    Age: 27
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 19
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 65
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 18
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: null
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: null
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 50
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 24
  },
  {
    Survived: 1,
    Sex: 'male',
    Age: 27
  },
  {
    Survived: 0,
    Sex: 'female',
    Age: 47
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: null
  },
  {
    Survived: 1,
    Sex: 'male',
    Age: 8
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 22
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 35
  },
  {
    Survived: 0,
    Sex: 'female',
    Age: 26
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 4
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 23
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 24
  },
  {
    Survived: 0,
    Sex: 'female',
    Age: 31
  },
  {
    Survived: 1,
    Sex: 'female',
    Age: 24
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 45
  },
  {
    Survived: 0,
    Sex: 'male',
    Age: 35
  }
];

// 图表配置
const spec = {
  type: 'common',
  color: ['blue', 'red'],
  series: [
    {
      type: 'scatter',
      xField: 'Age',
      yField: 'Survived',
      seriesField: 'Sex',
      point: {
        state: {
          hover: {
            scaleX: 1.2,
            scaleY: 1.2
          }
        },
        style: {
          fillOpacity: 0.5
        }
      }
    }
  ],
  tooltip: {
    dimension: {
      visible: true
    },
    mark: {
      title: true,
      content: [
        {
          key: d => d.name,
          value: d => d.y
        }
      ]
    }
  },
  crosshair: {
    yField: {
      visible: true,
      line: {
        visible: true,
        type: 'line'
      },
      label: {
        visible: true // label 默认关闭
      }
    },
    xField: {
      visible: true,
      line: {
        visible: true,
        type: 'line'
      },
      label: {
        visible: true // label 默认关闭
      }
    }
  },
  legends: {
    visible: true
  },
  axes: [
    {
      title: {
        visible: true,
        text: 'Age'
      },
      orient: 'left',
      type: 'linear',
      min: 0,
      max: 1
    },
    {
      title: {
        visible: true,
        text: 'Survived'
      },
      orient: 'bottom',
      label: { visible: true },
      type: 'linear'
    }
  ],
  data: [
    {
      id: 'data',
      values: data.flat()
    }
  ]
};

const run = () => {
  registerRegressionLine();
  appendScatterRegressionLineConfig(spec, [
    {
      type: 'logisitc',
      label: {
        text: 'logisitc'
      }
    }
  ]);

  const cs = new VChart(spec, {
    dom: document.getElementById('chart') as HTMLElement,
    //theme: 'dark',
    onError: err => {
      console.error(err);
    }
  });

  cs.renderSync();

  window['vchart'] = cs;
};
run();
