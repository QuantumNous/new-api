export enum AttributeLevel {
  Default = 0,
  Theme = 1,
  Chart = 2,
  Base_Series = 3, // general operation in base series
  Series = 4, // specified operation in derived series
  Mark = 5,
  User_Chart = 6,
  User_Series = 7,
  User_Mark = 8,
  User_SeriesStyle = 9,
  Built_In = 99
}
