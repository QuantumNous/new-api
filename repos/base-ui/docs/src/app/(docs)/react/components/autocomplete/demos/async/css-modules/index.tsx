'use client';
import * as React from 'react';
import { Autocomplete } from '@base-ui/react/autocomplete';
import styles from './index.module.css';

export default function ExampleAsyncAutocomplete() {
  const [searchValue, setSearchValue] = React.useState('');
  const [searchResults, setSearchResults] = React.useState<Movie[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  const [isPending, startTransition] = React.useTransition();

  const { contains } = Autocomplete.useFilter();

  const abortControllerRef = React.useRef<AbortController | null>(null);

  function getStatus(): React.ReactNode | null {
    if (isPending) {
      return (
        <React.Fragment>
          <span className={styles.Spinner} aria-hidden />
          Searching…
        </React.Fragment>
      );
    }

    if (error) {
      return error;
    }

    if (searchValue === '') {
      return null;
    }

    if (searchResults.length === 0) {
      return `Movie or year "${searchValue}" does not exist in the Top 100 IMDb movies`;
    }

    return `${searchResults.length} result${searchResults.length === 1 ? '' : 's'} found`;
  }

  const status = getStatus();

  return (
    <Autocomplete.Root
      items={searchResults}
      value={searchValue}
      onValueChange={(nextSearchValue) => {
        setSearchValue(nextSearchValue);

        const controller = new AbortController();
        abortControllerRef.current?.abort();
        abortControllerRef.current = controller;

        if (nextSearchValue === '') {
          setSearchResults([]);
          setError(null);
          return;
        }

        startTransition(async () => {
          setError(null);

          const result = await searchMovies(nextSearchValue, contains);
          if (controller.signal.aborted) {
            return;
          }

          startTransition(() => {
            setSearchResults(result.movies);
            setError(result.error);
          });
        });
      }}
      itemToStringValue={(item) => item.title}
      filter={null}
    >
      <label className={styles.Label}>
        Search movies by name or year
        <Autocomplete.Input placeholder="e.g. Pulp Fiction or 1994" className={styles.Input} />
      </label>

      <Autocomplete.Portal hidden={!status}>
        <Autocomplete.Positioner className={styles.Positioner} sideOffset={4} align="start">
          <Autocomplete.Popup className={styles.Popup} aria-busy={isPending || undefined}>
            <div className={styles.Viewport}>
              <Autocomplete.Status>
                {status && <div className={styles.Status}>{status}</div>}
              </Autocomplete.Status>
              <Autocomplete.List>
                {(movie: Movie) => (
                  <Autocomplete.Item key={movie.id} className={styles.Item} value={movie}>
                    <span className={styles.MovieItem}>
                      <span className={styles.MovieName}>{movie.title}</span>
                      <span className={styles.MovieYear}>{movie.year}</span>
                    </span>
                  </Autocomplete.Item>
                )}
              </Autocomplete.List>
            </div>
          </Autocomplete.Popup>
        </Autocomplete.Positioner>
      </Autocomplete.Portal>
    </Autocomplete.Root>
  );
}

async function searchMovies(
  query: string,
  filter: (item: string, query: string) => boolean,
): Promise<{ movies: Movie[]; error: string | null }> {
  // Simulate network delay
  await new Promise((resolve) => {
    setTimeout(resolve, Math.random() * 500 + 100);
  });

  // Simulate occasional network errors (1% chance)
  if (Math.random() < 0.01 || query === 'will_error') {
    return {
      movies: [],
      error: 'Failed to fetch movies. Please try again.',
    };
  }

  const movies = top100Movies.filter(
    (movie) => filter(movie.title, query) || filter(movie.year.toString(), query),
  );

  return {
    movies,
    error: null,
  };
}

interface Movie {
  id: string;
  title: string;
  year: number;
}

const top100Movies: Movie[] = [
  { id: '1', title: 'The Shawshank Redemption', year: 1994 },
  { id: '2', title: 'The Godfather', year: 1972 },
  { id: '3', title: 'The Dark Knight', year: 2008 },
  { id: '4', title: 'The Godfather Part II', year: 1974 },
  { id: '5', title: '12 Angry Men', year: 1957 },
  { id: '6', title: 'The Lord of the Rings: The Return of the King', year: 2003 },
  { id: '7', title: "Schindler's List", year: 1993 },
  { id: '8', title: 'Pulp Fiction', year: 1994 },
  { id: '9', title: 'The Lord of the Rings: The Fellowship of the Ring', year: 2001 },
  { id: '10', title: 'The Good, the Bad and the Ugly', year: 1966 },
  { id: '11', title: 'Forrest Gump', year: 1994 },
  { id: '12', title: 'The Lord of the Rings: The Two Towers', year: 2002 },
  { id: '13', title: 'Fight Club', year: 1999 },
  { id: '14', title: 'Inception', year: 2010 },
  { id: '15', title: 'Star Wars: Episode V – The Empire Strikes Back', year: 1980 },
  { id: '16', title: 'The Matrix', year: 1999 },
  { id: '17', title: 'Goodfellas', year: 1990 },
  { id: '18', title: 'Interstellar', year: 2014 },
  { id: '19', title: "One Flew Over the Cuckoo's Nest", year: 1975 },
  { id: '20', title: 'Se7en', year: 1995 },
  { id: '21', title: "It's a Wonderful Life", year: 1946 },
  { id: '22', title: 'The Silence of the Lambs', year: 1991 },
  { id: '23', title: 'Seven Samurai', year: 1954 },
  { id: '24', title: 'Saving Private Ryan', year: 1998 },
  { id: '25', title: 'City of God', year: 2002 },
  { id: '26', title: 'Life Is Beautiful', year: 1997 },
  { id: '27', title: 'The Green Mile', year: 1999 },
  { id: '28', title: 'Star Wars: Episode IV – A New Hope', year: 1977 },
  { id: '29', title: 'Terminator 2: Judgment Day', year: 1991 },
  { id: '30', title: 'Back to the Future', year: 1985 },
  { id: '31', title: 'Spirited Away', year: 2001 },
  { id: '32', title: 'The Pianist', year: 2002 },
  { id: '33', title: 'Psycho', year: 1960 },
  { id: '34', title: 'Parasite', year: 2019 },
  { id: '35', title: 'Gladiator', year: 2000 },
  { id: '36', title: 'Léon: The Professional', year: 1994 },
  { id: '37', title: 'American History X', year: 1998 },
  { id: '38', title: 'The Departed', year: 2006 },
  { id: '39', title: 'Whiplash', year: 2014 },
  { id: '40', title: 'The Prestige', year: 2006 },
  { id: '41', title: 'Grave of the Fireflies', year: 1988 },
  { id: '42', title: 'The Usual Suspects', year: 1995 },
  { id: '43', title: 'Casablanca', year: 1942 },
  { id: '44', title: 'Harakiri', year: 1962 },
  { id: '45', title: 'The Lion King', year: 1994 },
  { id: '46', title: 'The Intouchables', year: 2011 },
  { id: '47', title: 'Modern Times', year: 1936 },
  { id: '48', title: 'The Lives of Others', year: 2006 },
  { id: '49', title: 'Once Upon a Time in the West', year: 1968 },
  { id: '50', title: 'Rear Window', year: 1954 },
  { id: '51', title: 'Alien', year: 1979 },
  { id: '52', title: 'City Lights', year: 1931 },
  { id: '53', title: 'The Shining', year: 1980 },
  { id: '54', title: 'Cinema Paradiso', year: 1988 },
  { id: '55', title: 'Avengers: Infinity War', year: 2018 },
  { id: '56', title: 'Paths of Glory', year: 1957 },
  { id: '57', title: 'Django Unchained', year: 2012 },
  { id: '58', title: 'WALL·E', year: 2008 },
  { id: '59', title: 'Sunset Boulevard', year: 1950 },
  { id: '60', title: 'The Great Dictator', year: 1940 },
  { id: '61', title: 'The Dark Knight Rises', year: 2012 },
  { id: '62', title: 'Princess Mononoke', year: 1997 },
  { id: '63', title: 'Witness for the Prosecution', year: 1957 },
  { id: '64', title: 'Oldboy', year: 2003 },
  { id: '65', title: 'Aliens', year: 1986 },
  { id: '66', title: 'Once Upon a Time in America', year: 1984 },
  { id: '67', title: 'Coco', year: 2017 },
  { id: '68', title: 'Your Name.', year: 2016 },
  { id: '69', title: 'American Beauty', year: 1999 },
  { id: '70', title: 'Braveheart', year: 1995 },
  { id: '71', title: 'Das Boot', year: 1981 },
  { id: '72', title: '3 Idiots', year: 2009 },
  { id: '73', title: 'Toy Story', year: 1995 },
  { id: '74', title: 'Inglourious Basterds', year: 2009 },
  { id: '75', title: 'High and Low', year: 1963 },
  { id: '76', title: 'Amadeus', year: 1984 },
  { id: '77', title: 'Good Will Hunting', year: 1997 },
  { id: '78', title: 'Star Wars: Episode VI – Return of the Jedi', year: 1983 },
  { id: '79', title: 'The Hunt', year: 2012 },
  { id: '80', title: 'Capharnaüm', year: 2018 },
  { id: '81', title: 'Reservoir Dogs', year: 1992 },
  { id: '82', title: 'Eternal Sunshine of the Spotless Mind', year: 2004 },
  { id: '83', title: 'Requiem for a Dream', year: 2000 },
  { id: '84', title: 'Come and See', year: 1985 },
  { id: '85', title: 'Ikiru', year: 1952 },
  { id: '86', title: 'Vertigo', year: 1958 },
  { id: '87', title: 'Lawrence of Arabia', year: 1962 },
  { id: '88', title: 'Citizen Kane', year: 1941 },
  { id: '89', title: 'Memento', year: 2000 },
  { id: '90', title: 'North by Northwest', year: 1959 },
  { id: '91', title: 'Star Wars: Episode III – Revenge of the Sith', year: 2005 },
  { id: '92', title: '2001: A Space Odyssey', year: 1968 },
  { id: '93', title: 'Amélie', year: 2001 },
  { id: '94', title: "Singin' in the Rain", year: 1952 },
  { id: '95', title: 'Apocalypse Now', year: 1979 },
  { id: '96', title: 'Taxi Driver', year: 1976 },
  { id: '97', title: 'Downfall', year: 2004 },
  { id: '98', title: 'The Wolf of Wall Street', year: 2013 },
  { id: '99', title: 'A Clockwork Orange', year: 1971 },
  { id: '100', title: 'Double Indemnity', year: 1944 },
];
