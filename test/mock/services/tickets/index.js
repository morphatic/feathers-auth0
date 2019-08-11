module.exports = {
  createPasswordChangeTicket: data => {
    const { user_id } = data
    if (user_id === 'auth0|avaliduser') {
      return Promise.resolve('ok')
    } else {
      return Promise.reject({
        statusCode: 404,
        error: 'Not Found',
        message: 'The user does not exist.',
        errorCode: 'inexistent_user'
      })
    }
  },
  sendEmailVerification: async data => {
    const { user_id } = data
    if (user_id === 'auth0|avaliduser') {
      return Promise.resolve('ok')
    } else {
      return Promise.reject({
        statusCode: 404,
        error: 'Not Found',
        message: 'The user does not exist.',
        errorCode: 'inexistent_user'
      })
    }
  }
}