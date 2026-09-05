import { Menu } from '@base-ui/react/menu';
import styles from './LinkItemNavigation.module.css';

export default function MenuLinkItemNavigation() {
  return (
    <div className={styles.Page}>
      <h1 data-testid="page-heading" className={styles.Heading}>
        Menu with Link Items
      </h1>

      <Menu.Root>
        <Menu.Trigger data-testid="menu-trigger" className={styles.Trigger}>
          Open Menu
        </Menu.Trigger>

        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup className={styles.Popup}>
              <Menu.LinkItem
                data-testid="link-one"
                href="/e2e-fixtures/menu/PageOne"
                className={styles.LinkItem}
              >
                Page one
              </Menu.LinkItem>

              <Menu.LinkItem
                data-testid="link-two"
                href="/e2e-fixtures/menu/PageTwo"
                className={styles.LinkItem}
              >
                Page two
              </Menu.LinkItem>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </div>
  );
}
