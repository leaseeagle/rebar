// @flow

import AppBar from '@material-ui/core/AppBar'

import Checkbox from '@material-ui/core/Checkbox'

import FormGroup from '@material-ui/core/FormGroup'

import FormControlLabel from '@material-ui/core/FormControlLabel'

import List from '@material-ui/core/List'

import { withStyles } from '@material-ui/core/styles'

import { withRouter } from 'found'
import React from 'react'
import { createFragmentContainer, graphql } from 'react-relay'

import Tabs, { Tab } from '@material-ui/core/Tabs'

import ToDoListUpdateMarkAllMutation from '../../rb-example-todo-client/relay/ToDoListUpdateMarkAllMutation'

import ToDoItem from './ToDoItem'

const styles = theme => ({
  root: {
    width: '100%',
    maxWidth: 360,
    background: theme.palette.background.paper,
  },
})

class ToDoList extends React.Component<
  {
    Viewer: Object,
    relay: Object,
    router: Object,
  },
  null,
> {
  _handle_onClick_MarkAll = ( event, checked ) => {
    const { relay, Viewer } = this.props
    const { variables } = this.context.relay
    const ToDo_Complete = checked

    ToDoListUpdateMarkAllMutation.commit(
      relay.environment,
      Viewer,
      Viewer.ToDos,
      ToDo_Complete,
      variables.status,
    )
  }

  _handle_onChange = ( event, tabsValue ) => {
    const url = tabsValue === 2 ? '/todo/completed' : tabsValue === 1 ? '/todo/active' : '/todo'
    this.context.router.push( url )
  }

  renderTabs() {
    const status = this.context.relay.variables.status
    const tabsValue = status === 'active' ? 1 : status === 'completed' ? 2 : 0

    return (
      <AppBar position="static">
        <Tabs value={tabsValue} onChange={this._handle_onChange}>
          <Tab label="All" />
          <Tab label="Active" />
          <Tab label="Completed" />
        </Tabs>
      </AppBar>
    )
  }

  render() {
    const { Viewer } = this.props
    const { ToDos, ToDo_TotalCount, ToDo_CompletedCount } = Viewer

    if ( !ToDo_TotalCount ) {
      return null
    }

    return (
      <div>
        {this.renderTabs()}
        <FormGroup row>
          <FormControlLabel
            control={
              <Checkbox
                checked={ToDo_TotalCount === ToDo_CompletedCount}
                onChange={this._handle_onClick_MarkAll}
              />
            }
            label="Mark all as complete"
          />
        </FormGroup>
        <List>
          {ToDos.edges.map( ({ node }) => (
            <ToDoItem key={node.id} Viewer={Viewer} ToDo={node} />
          ) )}
        </List>
      </div>
    )
  }
}

export default createFragmentContainer(
  withStyles( styles )( withRouter( ToDoList ) ),
  graphql`
    fragment ToDoList_Viewer on Viewer {
      ToDos(status: $status, first: 2147483647) @connection(key: "ToDoList_ToDos") {
        edges {
          node {
            id
            ToDo_Complete
            ...ToDoItem_ToDo
          }
        }
      }
      id
      ToDo_TotalCount
      ToDo_CompletedCount
      ...ToDoItem_Viewer
    }
  `,
)
