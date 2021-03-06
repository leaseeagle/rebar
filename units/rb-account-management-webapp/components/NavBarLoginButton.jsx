// @flow

import { withRouter } from 'found'

import IconButton from '@material-ui/core/IconButton'

import Menu from '@material-ui/core/Menu'

import MenuItem from '@material-ui/core/MenuItem'

import { withStyles } from '@material-ui/core/styles'

import IconAccount from 'mdi-material-ui/Account'
import IconAccountOutline from 'mdi-material-ui/AccountOutline'
import React from 'react'
import { createFragmentContainer, graphql } from 'react-relay'

import {
  registerAuthenticationRequiredCallback,
  unregisterAuthenticationRequiredCallback,
} from './RequiresAuthentication'
import LoginDialog from './LoginDialog'

//

const styles = {}

//

class NavBarLoginButton extends React.Component<
  {
    Viewer: Object,
    relay: Object,
    router: Object,
  },
  {
    anchorEl: ?Object,
    loginDialogIsOpen: boolean,
    userMenuIsOpen: boolean,
  }
> {
  constructor( props: Object, context: Object ) {
    super( props, context )

    this.state = {
      anchorEl: undefined,
      loginDialogIsOpen: false,
      userMenuIsOpen: false,
    }
  }

  // Handle popping open the login dialog if authentication is required
  UNSAFE_componentWillMount() {
    registerAuthenticationRequiredCallback( this._handle_onClick_Login )
  }

  componentWillUnmount() {
    unregisterAuthenticationRequiredCallback()
  }

  _handle_onClick_Login = () => {
    this.setState({ loginDialogIsOpen: true, userMenuIsOpen: false })
  }

  _handle_onClick_Profile = () => {
    this.setState({ userMenuIsOpen: false })

    this.props.router.push( '/user/profile' )
  }

  _handle_Login_Close = () => {
    this.setState({ loginDialogIsOpen: false })
  }

  _handle_onClick_UserMenu = event => {
    this.setState({ userMenuIsOpen: true, anchorEl: event.currentTarget })
  }

  _handle_UserMenu_Close = () => {
    this.setState({ userMenuIsOpen: false })
  }

  _handle_onClick_Logout = () => {
    this.setState({ userMenuIsOpen: false })
    this.props.router.push( '/user/logout' )
  }

  _handle_Login_NewUser = () => {
    this.setState({ loginDialogIsOpen: false })

    this.props.router.push( '/user/new' )
  }

  render() {
    const { User_IsAnonymous, User_DisplayName } = this.props.Viewer
    const { loginDialogIsOpen, userMenuIsOpen } = this.state

    return (
      <div>
        <IconButton
          aria-haspopup="true"
          onClick={
            User_IsAnonymous
              ? this._handle_onClick_Login
              : this._handle_onClick_UserMenu
          }
          color="inherit"
        >
          {User_IsAnonymous ? <IconAccountOutline /> : <IconAccount />}
        </IconButton>

        <LoginDialog
          open={loginDialogIsOpen}
          handlerClose={this._handle_Login_Close}
          handlerNewUser={this._handle_Login_NewUser}
        />

        <Menu
          id="lock-menu"
          anchorEl={this.state.anchorEl}
          open={userMenuIsOpen}
          onClose={this._handle_UserMenu_Close}
        >
          <MenuItem key="profile" onClick={this._handle_onClick_Profile}>
            {User_DisplayName}
          </MenuItem>
          <MenuItem key="login" onClick={this._handle_onClick_Login}>
            Change user
          </MenuItem>
          <MenuItem key="logout" onClick={this._handle_onClick_Logout}>
            Log out
          </MenuItem>
        </Menu>
      </div>
    )
  }
}

export default createFragmentContainer(
  withStyles( styles )( withRouter( NavBarLoginButton ) ),
  graphql`
    fragment NavBarLoginButton_Viewer on Viewer {
      User_IsAnonymous
      User_DisplayName
    }
  `
)
